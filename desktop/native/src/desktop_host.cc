#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <vector>
#include <string>
#include <algorithm>
#include <cmath>
#include <iterator>
#include <cstdint>
#include <napi.h>

namespace {
constexpr UINT kProgmanCreateWorker = 0x052C;
constexpr LONG_PTR kStyleIndex = GWL_STYLE;
constexpr LONG_PTR kExStyleIndex = GWL_EXSTYLE;

struct DesktopHost {
  HWND handle = nullptr;
  RECT bounds{};
  HWND iconView = nullptr;
};

std::vector<DesktopHost> g_hosts;

bool IsWindowClass(HWND hwnd, const wchar_t* expected) {
  wchar_t name[128]{};
  return hwnd && GetClassNameW(hwnd, name, static_cast<int>(std::size(name))) > 0 && _wcsicmp(name, expected) == 0;
}

BOOL CALLBACK CollectHosts(HWND top, LPARAM) {
  HWND view = FindWindowExW(top, nullptr, L"SHELLDLL_DefView", nullptr);
  if (!view) return TRUE;
  HWND worker = FindWindowExW(nullptr, top, L"WorkerW", nullptr);
  if (!worker || !IsWindow(worker)) return TRUE;

  RECT bounds{};
  if (!GetWindowRect(worker, &bounds) || bounds.right <= bounds.left || bounds.bottom <= bounds.top) return TRUE;
  const auto duplicate = std::find_if(g_hosts.begin(), g_hosts.end(), [worker](const DesktopHost& item) { return item.handle == worker; });
  if (duplicate == g_hosts.end()) g_hosts.push_back({ worker, bounds, view });
  return TRUE;
}

void AskExplorerForWallpaperHost() {
  const HWND progman = FindWindowW(L"Progman", nullptr);
  if (!progman) return;
  DWORD_PTR result = 0;
  SendMessageTimeoutW(progman, kProgmanCreateWorker, 0, 0, SMTO_ABORTIFHUNG | SMTO_BLOCK, 180, &result);
  SendMessageTimeoutW(progman, kProgmanCreateWorker, 0xD, 0, SMTO_ABORTIFHUNG | SMTO_BLOCK, 180, &result);
  SendMessageTimeoutW(progman, kProgmanCreateWorker, 0xD, 1, SMTO_ABORTIFHUNG | SMTO_BLOCK, 180, &result);
}

std::vector<DesktopHost> EnumerateHosts() {
  g_hosts.clear();
  EnumWindows(CollectHosts, 0);
  if (g_hosts.empty()) {
    AskExplorerForWallpaperHost();
    g_hosts.clear();
    EnumWindows(CollectHosts, 0);
  }
  return g_hosts;
}

HWND ReadHandle(const Napi::Value& value) {
  if (!value.IsBuffer()) throw Napi::TypeError::New(value.Env(), "La poignée native doit être un Buffer Electron.");
  const auto buffer = value.As<Napi::Buffer<uint8_t>>();
  if (buffer.Length() < sizeof(void*)) throw Napi::TypeError::New(value.Env(), "Poignée de fenêtre invalide.");
  return *reinterpret_cast<HWND*>(buffer.Data());
}

void SetLongPtr(Napi::Env env, HWND hwnd, LONG_PTR index, LONG_PTR value) {
  SetLastError(0);
  const LONG_PTR previous = SetWindowLongPtrW(hwnd, static_cast<int>(index), value);
  if (previous == 0 && GetLastError() != 0) throw Napi::Error::New(env, "Windows n’a pas accepté le style de fenêtre demandé.");
}

Napi::Value EnumerateDesktopHosts(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Array result = Napi::Array::New(env);
  const auto hosts = EnumerateHosts();
  for (uint32_t i = 0; i < hosts.size(); ++i) {
    const auto& source = hosts[i];
    Napi::Object entry = Napi::Object::New(env);
    entry.Set("handle", Napi::BigInt::New(env, static_cast<uint64_t>(reinterpret_cast<uintptr_t>(source.handle))));
    entry.Set("bounds", Napi::Object::New(env));
    Napi::Object bounds = entry.Get("bounds").As<Napi::Object>();
    bounds.Set("x", Napi::Number::New(env, source.bounds.left));
    bounds.Set("y", Napi::Number::New(env, source.bounds.top));
    bounds.Set("width", Napi::Number::New(env, source.bounds.right - source.bounds.left));
    bounds.Set("height", Napi::Number::New(env, source.bounds.bottom - source.bounds.top));
    result.Set(i, entry);
  }
  return result;
}

Napi::Value AttachToDesktop(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[2].IsObject()) throw Napi::TypeError::New(env, "Écran ou fenêtre manquant.");
  const HWND child = ReadHandle(info[0]);
  const HWND parent = ReadHandle(info[1]);
  if (!IsWindow(child) || !IsWindow(parent)) throw Napi::Error::New(env, "La surface du bureau a changé pendant le démarrage.");

  Napi::Object display = info[2].As<Napi::Object>();
  const double scale = display.Get("scale").ToNumber().DoubleValue();
  if (!(scale > 0.25 && scale < 8.0)) throw Napi::RangeError::New(env, "Facteur d’échelle d’écran invalide.");
  const int left = static_cast<int>(std::lround(display.Get("x").ToNumber().DoubleValue() * scale));
  const int top = static_cast<int>(std::lround(display.Get("y").ToNumber().DoubleValue() * scale));
  const int width = static_cast<int>(std::lround(display.Get("width").ToNumber().DoubleValue() * scale));
  const int height = static_cast<int>(std::lround(display.Get("height").ToNumber().DoubleValue() * scale));
  RECT parentBounds{};
  if (!GetWindowRect(parent, &parentBounds)) throw Napi::Error::New(env, "La géométrie du bureau Windows est indisponible.");

  const LONG_PTR style = GetWindowLongPtrW(child, static_cast<int>(kStyleIndex));
  const LONG_PTR exStyle = GetWindowLongPtrW(child, static_cast<int>(kExStyleIndex));
  const LONG_PTR newStyle = (style & ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX)) |
      WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN;
  const LONG_PTR newExStyle = (exStyle | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_LAYERED) & ~WS_EX_APPWINDOW;

  SetLongPtr(env, child, kStyleIndex, newStyle);
  SetLongPtr(env, child, kExStyleIndex, newExStyle);
  SetLastError(0);
  const HWND previousParent = SetParent(child, parent);
  if (!previousParent && GetLastError() != 0) throw Napi::Error::New(env, "Windows n’a pas pu placer la scène derrière les icônes.");
  const int x = left - parentBounds.left;
  const int y = top - parentBounds.top;
  if (!SetWindowPos(child, nullptr, x, y, width, height, SWP_NOACTIVATE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW)) {
    throw Napi::Error::New(env, "Windows n’a pas pu dimensionner la scène de bureau.");
  }
  return Napi::Boolean::New(env, true);
}

Napi::Value GetParentHandle(const Napi::CallbackInfo& info) {
  if (info.Length() < 1) throw Napi::TypeError::New(info.Env(), "Fenêtre manquante.");
  const HWND child = ReadHandle(info[0]);
  const HWND parent = IsWindow(child) ? GetParent(child) : nullptr;
  if (!parent) return info.Env().Null();
  return Napi::BigInt::New(info.Env(), static_cast<uint64_t>(reinterpret_cast<uintptr_t>(parent)));
}

Napi::Value IsDesktopForeground(const Napi::CallbackInfo& info) {
  HWND foreground = GetForegroundWindow();
  if (!foreground) return Napi::Boolean::New(info.Env(), false);
  const HWND root = GetAncestor(foreground, GA_ROOT);
  return Napi::Boolean::New(info.Env(), IsWindowClass(root, L"Progman") || IsWindowClass(root, L"WorkerW"));
}

Napi::Object Initialize(Napi::Env env, Napi::Object exports) {
  exports.Set("enumerateDesktopHosts", Napi::Function::New(env, EnumerateDesktopHosts));
  exports.Set("attachToDesktop", Napi::Function::New(env, AttachToDesktop));
  exports.Set("getParentHandle", Napi::Function::New(env, GetParentHandle));
  exports.Set("isDesktopForeground", Napi::Function::New(env, IsDesktopForeground));
  return exports;
}
}  // namespace

NODE_API_MODULE(desktop_host, Initialize)
