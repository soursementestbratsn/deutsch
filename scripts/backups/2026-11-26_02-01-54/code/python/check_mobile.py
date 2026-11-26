#!/usr/bin/env python3
"""
Mobile validation checks for Deutsch Quest
Verifies touch targets, safe areas, viewport, and mobile-specific issues
"""
import re
import sys
from pathlib import Path

WEB_DIR = Path(__file__).parent.parent / "web"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def check_file_exists(path, description):
    """Check if a file exists"""
    if path.exists():
        print(f"{GREEN}✓{RESET} {description}: {path.name}")
        return True
    else:
        print(f"{RED}✗{RESET} {description}: {path.name} NOT FOUND")
        return False

def check_viewport_meta():
    """Check index.html for proper viewport meta tag"""
    index_path = WEB_DIR / "index.html"
    content = index_path.read_text(encoding="utf-8")
    
    checks = [
        ('viewport-fit=cover', 'viewport-fit=cover'),
        ('apple-mobile-web-app-capable', 'PWA capable meta'),
        ('apple-mobile-web-app-status-bar-style', 'Status bar style meta'),
        ('apple-mobile-web-app-title', 'App title meta'),
        ('manifest.json', 'Manifest link'),
    ]
    
    all_pass = True
    for pattern, desc in checks:
        if pattern in content:
            print(f"{GREEN}✓{RESET} {desc}")
        else:
            print(f"{RED}✗{RESET} {desc} - missing '{pattern}'")
            all_pass = False
    return all_pass

def check_touch_targets():
    """Check CSS for minimum 44x44px touch targets"""
    glass_path = WEB_DIR / "glass.css"
    content = glass_path.read_text(encoding="utf-8")
    
    # Check for touch target rule
    if "min-height: 44px" in content and "min-width: 44px" in content:
        print(f"{GREEN}✓{RESET} Touch targets: 44x44px minimum defined")
    else:
        print(f"{RED}✗{RESET} Touch targets: 44x44px minimum NOT found")
        return False
    
    # Check for touch-action: manipulation
    if "touch-action: manipulation" in content:
        print(f"{GREEN}✓{RESET} Touch action manipulation defined")
    else:
        print(f"{YELLOW}⚠{RESET} Touch action manipulation not found")
    
    return True

def check_font_size_inputs():
    """Check that inputs have minimum 16px font size"""
    glass_path = WEB_DIR / "glass.css"
    content = glass_path.read_text(encoding="utf-8")
    
    if "font-size: 16px !important" in content:
        print(f"{GREEN}✓{RESET} Input font-size: 16px minimum (prevents iOS zoom)")
    else:
        print(f"{RED}✗{RESET} Input font-size: 16px minimum NOT found")
        return False
    return True

def check_safe_areas():
    """Check for safe area inset usage"""
    glass_path = WEB_DIR / "glass.css"
    nav_css_path = WEB_DIR / "nav.css"
    
    glass_content = glass_path.read_text(encoding="utf-8")
    nav_content = nav_css_path.read_text(encoding="utf-8")
    
    # Check for CSS variable definitions (modern approach)
    var_checks = [
        ('--safe-top: env(safe-area-inset-top', glass_content, 'safe-area-inset-top variable defined'),
        ('--safe-bottom: env(safe-area-inset-bottom', glass_content, 'safe-area-inset-bottom variable defined'),
        ('--safe-left: env(safe-area-inset-left', glass_content, 'safe-area-inset-left variable defined'),
        ('--safe-right: env(safe-area-inset-right', glass_content, 'safe-area-inset-right variable defined'),
    ]
    
    # Check for actual usage in nav.css
    usage_checks = [
        ('env(safe-area-inset-bottom)', nav_content, 'safe-area-inset-bottom in nav.css (bottom nav)'),
    ]
    
    all_pass = True
    for pattern, content, desc in var_checks:
        if pattern in content:
            print(f"{GREEN}✓{RESET} {desc}")
        else:
            print(f"{RED}✗{RESET} {desc}")
            all_pass = False
    
    for pattern, content, desc in usage_checks:
        if pattern in content:
            print(f"{GREEN}✓{RESET} {desc}")
        else:
            print(f"{RED}✗{RESET} {desc}")
            all_pass = False
            
    return all_pass

def check_bottom_nav():
    """Check bottom navigation implementation"""
    nav_css_path = WEB_DIR / "nav.css"
    nav_js_path = WEB_DIR / "nav.js"
    index_path = WEB_DIR / "index.html"
    
    nav_css = nav_css_path.read_text(encoding="utf-8")
    nav_js = nav_js_path.read_text(encoding="utf-8")
    index_html = index_path.read_text(encoding="utf-8")
    
    checks = [
        ('.bottom-nav', nav_css, 'Bottom nav CSS class'),
        ('bottom: 0', nav_css, 'Bottom nav fixed positioning'),
        ('bottomNav', index_html, 'Bottom nav HTML element'),
        ('bottomNav', nav_js, 'Bottom nav JS handling'),
        ('paintActive', nav_js, 'Bottom nav active state sync'),
    ]
    
    all_pass = True
    for pattern, content, desc in checks:
        if pattern in content:
            print(f"{GREEN}✓{RESET} {desc}")
        else:
            print(f"{RED}✗{RESET} {desc}")
            all_pass = False
    return all_pass

def check_mobile_performance():
    """Check mobile performance optimizations"""
    glass_path = WEB_DIR / "glass.css"
    content = glass_path.read_text(encoding="utf-8")
    
    checks = [
        ('@media (max-width: 768px)', content, 'Mobile media query'),
        ('backdrop-filter: blur(8px)', content, 'Reduced blur on mobile'),
        ('display: none !important', content, 'Glass light disabled on mobile'),
    ]
    
    all_pass = True
    for pattern, content, desc in checks:
        if pattern in content:
            print(f"{GREEN}✓{RESET} {desc}")
        else:
            print(f"{YELLOW}⚠{RESET} {desc} (optional)")
    return all_pass

def check_fluid_typography():
    """Check for fluid typography using clamp()"""
    glass_path = WEB_DIR / "glass.css"
    content = glass_path.read_text(encoding="utf-8")
    
    if "clamp(" in content and "--fs-" in content:
        print(f"{GREEN}✓{RESET} Fluid typography with clamp()")
        return True
    else:
        print(f"{RED}✗{RESET} Fluid typography NOT found")
        return False

def check_manifest():
    """Check manifest.json exists and has required fields"""
    manifest_path = WEB_DIR / "manifest.json"
    if not manifest_path.exists():
        print(f"{RED}✗{RESET} manifest.json NOT FOUND")
        return False
    
    import json
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        required = ['name', 'short_name', 'start_url', 'display', 'icons']
        all_pass = True
        for field in required:
            if field in manifest:
                print(f"{GREEN}✓{RESET} Manifest field: {field}")
            else:
                print(f"{RED}✗{RESET} Manifest missing: {field}")
                all_pass = False
        return all_pass
    except json.JSONDecodeError:
        print(f"{RED}✗{RESET} manifest.json is invalid JSON")
        return False

def check_service_worker():
    """Check service worker exists"""
    sw_path = WEB_DIR / "sw.js"
    if not sw_path.exists():
        print(f"{RED}✗{RESET} sw.js NOT FOUND")
        return False
    
    content = sw_path.read_text(encoding="utf-8")
    checks = [
        ('install', 'Install event'),
        ('activate', 'Activate event'),
        ('fetch', 'Fetch event'),
        ('caches.open', 'Cache API usage'),
    ]
    
    all_pass = True
    for pattern, desc in checks:
        if pattern in content:
            print(f"{GREEN}✓{RESET} SW: {desc}")
        else:
            print(f"{RED}✗{RESET} SW: {desc} missing")
            all_pass = False
    return all_pass

def check_no_horizontal_overflow():
    """Check for overflow-x: hidden"""
    glass_path = WEB_DIR / "glass.css"
    content = glass_path.read_text(encoding="utf-8")
    
    if "overflow-x: hidden" in content:
        print(f"{GREEN}✓{RESET} Horizontal overflow prevention")
        return True
    else:
        print(f"{RED}✗{RESET} Horizontal overflow prevention missing")
        return False

def check_focus_visible():
    """Check for focus-visible styles"""
    glass_path = WEB_DIR / "glass.css"
    content = glass_path.read_text(encoding="utf-8")
    
    if ":focus-visible" in content:
        print(f"{GREEN}✓{RESET} Focus visible styles")
        return True
    else:
        print(f"{RED}✗{RESET} Focus visible styles missing")
        return False

def main():
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Deutsch Quest - Mobile Validation Checks{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    checks = [
        ("File Existence", lambda: all([
            check_file_exists(WEB_DIR / "manifest.json", "Manifest"),
            check_file_exists(WEB_DIR / "sw.js", "Service Worker"),
        ])),
        ("Viewport & PWA Meta", check_viewport_meta),
        ("Touch Targets (44x44)", check_touch_targets),
        ("Input Font Size (16px)", check_font_size_inputs),
        ("Safe Areas", check_safe_areas),
        ("Bottom Navigation", check_bottom_nav),
        ("Mobile Performance", check_mobile_performance),
        ("Fluid Typography", check_fluid_typography),
        ("Manifest.json", check_manifest),
        ("Service Worker", check_service_worker),
        ("No Horizontal Overflow", check_no_horizontal_overflow),
        ("Focus Visible", check_focus_visible),
    ]
    
    results = []
    for name, check_func in checks:
        print(f"\n{BLUE}--- {name} ---{RESET}")
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"{RED}✗{RESET} {name} failed with error: {e}")
            results.append((name, False))
    
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}SUMMARY{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"  {status}  {name}")
    
    print(f"\n{BLUE}Total: {passed}/{total} checks passed{RESET}")
    
    if passed == total:
        print(f"{GREEN}All mobile checks passed!{RESET}")
        return 0
    else:
        print(f"{RED}Some checks failed. Please review.{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())