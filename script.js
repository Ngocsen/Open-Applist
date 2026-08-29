const ST_KEYS = {
    app: 'myAppList', name: 'myAppNames', dock: 'myDockApps', mark: 'effectMarkStyle',
    radius: 'effectRadiusStyle', dir: 'effectShadowDirection', blur: 'effectShadowBlur',
    offset: 'effectShadowOffset', opacity: 'effectShadowOpacity', dockStyle: 'dockStyle',
    stroke: 'effectStroke', hideLab: 'hideLabels', bgDir: 'bgShadowDirection',
    bgBlur: 'bgShadowBlur', bgOffset: 'bgShadowOffset', bgOpacity: 'bgShadowOpacity',
    custom: 'customApps', haptic: 'hapticSound', cMain: 'colorMainBg', cCont: 'colorContainer',
    cDock: 'colorDock', fastRename: 'fastRenameMode'
};

const FALLBACK_DB = {
    "com.apple.Preferences": { "Name": "Settings", "icon": "systemapp/settings.png" },
    "com.apple.mobilesafari": { "Name": "Safari", "icon": "systemapp/safari.png" },
    "com.apple.mobileslideshow": { "Name": "Photos", "icon": "systemapp/photos.png" },
    "com.apple.AppStore": { "Name": "App Store", "icon": "systemapp/appstore.png" },
    "com.apple.camera": { "Name": "Camera", "icon": "systemapp/camera.png" }
};

const supportedLangs = ['ar', 'bn-BD', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'en-GB', 'en-US', 'es-ES', 'es-MX', 'fa-IR', 'fi-FI', 'fil-PH', 'fr-CA', 'fr-FR', 'hi-IN', 'hu-HU', 'id-ID', 'it-IT', 'ja', 'ko-KR', 'ms-MY', 'nb-NO', 'nl-NL', 'pl-PL', 'pt-BR', 'pt-PT', 'ro-RO', 'ru', 'sv-SE', 'sw-KE', 'th-TH', 'tr-TR', 'uk-UA', 'vi-VN', 'zh-CN', 'zh-TW'];

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let appDatabase = {}, socialData = { links: { email: '', social_follow: '', plugin_shortcut: '' } }, langData = {};
const basePath = '.';

const MAX_APPS = 12, MAX_DOCK_APPS = 3;
let isDeleteMode = false, isAddingDock = false, isFastRenameMode = false;
let searchTimeout = null, currentSearchLimit = 12, currentLocalLimit = 12, currentStore = 'vn', currentQuery = '';
let renameAppId = null;

const grid = document.getElementById('appGrid'), dockArea = document.getElementById('dockArea'), drawerWrapper = document.getElementById('drawerWrapper'), drawerContent = document.getElementById('drawerContent'), mainAppContainer = document.getElementById('mainAppContainer');
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// Hàm an toàn: Lấy element (tránh lỗi null)
const $ = (id) => document.getElementById(id);

async function resolveLanguage() {
    let userLang = navigator.language || navigator.languages?.[0] || 'vi-VN';
    let exactLang = supportedLangs.find(l => l.toLowerCase() === userLang.toLowerCase()) || 
                    supportedLangs.find(l => l.startsWith(userLang.split('-')[0])) || 'vi-VN';
    
    document.documentElement.dir = (exactLang === 'ar' || exactLang === 'fa-IR') ? 'rtl' : 'ltr';

    try {
        const enRes = await fetch(`${basePath}/Language/en-US.json`);
        const enData = enRes.ok ? await enRes.json() : {};
        let targetData = {};
        if (exactLang !== 'en-US') {
            // Đã sửa lỗi tên file: chuyển gạch ngang thành gạch chân nếu cần
            const targetFileName = exactLang.replace('-', '_');
            const targetRes = await fetch(`${basePath}/Language/${targetFileName}.json`);
            if (targetRes.ok) targetData = await targetRes.json();
        }
        langData = mergeDeep(enData, targetData);
    } catch (error) {
        console.error("i18n Load Error:", error);
        langData = {};
    }
}

function mergeDeep(target, source) {
    let output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) Object.assign(output, { [key]: source[key] });
                else output[key] = mergeDeep(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}
function isObject(item) { return (item && typeof item === 'object' && !Array.isArray(item)); }

function playHapticSound() {
    if (localStorage.getItem(ST_KEYS.haptic) === 'false') return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}

function createRipple(event, button) {
    if(!button.classList.contains('ripple-wrapper')) button.classList.add('ripple-wrapper');
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    const rect = button.getBoundingClientRect();
    let x, y;
    if(event.touches && event.touches.length > 0) {
        x = event.touches[0].clientX - rect.left; y = event.touches[0].clientY - rect.top;
    } else { x = event.clientX - rect.left; y = event.clientY - rect.top; }
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${x - radius}px`; circle.style.top = `${y - radius}px`;
    circle.classList.add("ripple");
    const existing = button.querySelector('.ripple'); if (existing) existing.remove();
    button.appendChild(circle);
    setTimeout(() => { if(circle.parentNode) circle.remove(); }, 600);
}

document.body.addEventListener('touchstart', function(e) {
    let target = e.target.closest('button, .app-item, .drawer-btn, .close-modal, .dir-btn');
    if(target) { playHapticSound(); if(target.tagName === 'BUTTON' || target.classList.contains('close-modal')) createRipple(e, target); }
}, {passive: true});

function setSafeText(id, text) { const el = $(id); if(el) el.innerText = text; }

function applyLanguage() {
    setSafeText('infoTitle', langData?.info_popup?.title || 'Thông tin');
    const infoDetails = $('infoDetails');
    if (infoDetails && langData?.info_popup?.details) {
        infoDetails.innerHTML = langData.info_popup.details;
        infoDetails.style.display = 'block';
    }
    setSafeText('onboardingTitle', langData?.onboarding?.title || 'Hướng dẫn');
    setSafeText('onboardingDesc', langData?.onboarding?.desc || 'Vui lòng thêm ứng dụng vào Màn hình chính (Add to Home Screen) để sử dụng đầy đủ tính năng!');
    setSafeText('closeOnboarding', langData?.button?.close || 'Đóng');
    
    setSafeText('btnMail', langData?.info_popup?.contact || 'Liên hệ');
    setSafeText('btnFollow', langData?.info_popup?.follow || 'Theo dõi');
    setSafeText('btnInfoDetails', langData?.info_popup?.info || 'Thông tin ứng dụng');
    
    const btnInfoDetails = $('btnInfoDetails');
    if (btnInfoDetails) {
        btnInfoDetails.onclick = () => {
            alert(langData?.dock_info?.app_version || "Snowboard v1.0");
        };
    }

    setSafeText('txtSettingTitle', langData?.effects?.settings?.title || 'Cài đặt');
    setSafeText('openEffectsBtn', langData?.effects?.settings?.effects_menu || 'Cài đặt icon');
    setSafeText('openBgEffectsBtn', langData?.effects?.settings?.bg_menu || 'Cài đặt nền');
    setSafeText('txtBgEffectTitle', langData?.effects?.title_bg || 'Hiệu ứng nền');
    setSafeText('lblColorMain', langData?.effects?.color_main || 'Màu nền chính:');
    setSafeText('lblColorContainer', langData?.effects?.color_container || 'Màu khung App:');
    setSafeText('lblColorDock', langData?.effects?.color_dock || 'Màu nền Dock:');
    setSafeText('lblBgShadowDirection', langData?.effects?.shadow_direction_label || 'Hướng đổ bóng:');
    setSafeText('lblBgShadowBlur', langData?.effects?.shadow_blur_label || 'Độ rõ:');
    setSafeText('lblBgShadowOffset', langData?.effects?.shadow_offset_label || 'Khoảng cách:');
    setSafeText('lblBgShadowOpacity', langData?.effects?.shadow_opacity_label || 'Đậm nhạt 0-100:');
    setSafeText('saveBgEffectBtn', langData?.effects?.save || 'Lưu hiệu ứng');
    setSafeText('openDockBtn', langData?.effects?.settings?.dock_menu || 'Cài đặt Dock');
    setSafeText('openLabelsBtn', langData?.app_menu?.manage_apps || 'Cài đặt ứng dụng');
    setSafeText('exportBtn', langData?.common?.export_config || '📤 Xuất Cấu Hình');
    setSafeText('importBtn', langData?.common?.import_config || '📥 Nhập');
    setSafeText('lblLabelsTitle', langData?.app_menu?.manage_apps || 'Cài đặt ứng dụng');
    setSafeText('txtHideLabels', langData?.common?.hide_app_name || 'Ẩn tên ứng dụng');
    setSafeText('txtShowLabels', langData?.common?.show_app_name || 'Hiện tên ứng dụng');
    setSafeText('txtFastRename', langData?.common?.fast_rename_mode || 'Chế độ Đổi tên nhanh');
    setSafeText('txtHapticSound', langData?.common?.haptic_sound || 'Âm thanh chạm (Haptic)');
    setSafeText('saveLabelsBtn', langData?.button?.save_config || 'Lưu cấu hình');
    setSafeText('txtEffectTitle', langData?.effects?.title || 'Đổ bóng icon');
    setSafeText('txtVisionStroke', langData?.effects?.vision_stroke || 'Viền VisionOS');
    setSafeText('lblMarkStyle', langData?.effects?.mark_label || 'Kiểu Mark');
    setSafeText('lblShadowDirection', langData?.effects?.shadow_direction_label || 'Hướng đổ bóng:');
    setSafeText('lblShadowBlur', langData?.effects?.shadow_blur_label || 'Độ rõ:');
    setSafeText('lblShadowOffset', langData?.effects?.shadow_offset_label || 'Khoảng cách:');
    setSafeText('lblShadowOpacity', langData?.effects?.shadow_opacity_label || 'Đậm nhạt 0-100:');
    setSafeText('lblRadiusStyle', langData?.effects?.radius_label || 'Kiểu Bo góc Icon');
    setSafeText('saveEffectBtn', langData?.effects?.save || 'Lưu hiệu ứng');
    setSafeText('txtDockTitle', langData?.effects?.dock?.title || 'Cài đặt Dock');
    setSafeText('txtDockGlass', langData?.effects?.dock?.glass || 'Kính trong suốt');
    setSafeText('txtDockWood', langData?.effects?.dock?.wood || 'Gỗ (iOS 6)');
    setSafeText('txtDockBlur', langData?.effects?.dock?.blur || 'Mờ Đen');
    setSafeText('txtDockDisable', langData?.effects?.dock?.disable || 'Tắt Dock');
    setSafeText('saveDockBtn', langData?.effects?.dock?.save || 'Lưu cấu hình');
    
    document.querySelectorAll('.lang-close').forEach(el => el.innerText = langData?.button?.close || 'Đóng');
    document.querySelectorAll('.lang-cancel').forEach(el => el.innerText = langData?.button?.cancel || 'Huỷ');
    
    setSafeText('renameTitle', langData?.messages?.prompt_rename_app || 'Đổi tên ứng dụng');
    setSafeText('renameCancelBtn', langData?.button?.cancel || 'Huỷ');
    setSafeText('renameOkBtn', langData?.button?.save_config || 'Lưu');
    setSafeText('importTitle', langData?.messages?.prompt_import_code || 'Nhập mã cấu hình');
    setSafeText('importCancelBtn', langData?.button?.cancel || 'Huỷ');
    setSafeText('importOkBtn', langData?.button?.save_config || 'Xác nhận');

    setSafeText('txtAddAppTitle', langData?.modal?.title_add_app || 'Thêm ứng dụng');
    let loadMoreText = langData?.button?.load_more || 'Xem thêm';
    setSafeText('btnLoadMoreOnline', loadMoreText);
    setSafeText('btnLoadMoreLocal', loadMoreText);
    
    if ($('appSearchInput')) $('appSearchInput').placeholder = langData?.modal?.search_placeholder || '🔍 Tìm kiếm...';
}

function applySystemTheme(isDark) {
    let cMain = localStorage.getItem(ST_KEYS.cMain);
    let cCont = localStorage.getItem(ST_KEYS.cCont);
    let cDock = localStorage.getItem(ST_KEYS.cDock);
    if (!cMain && !cCont && !cDock) {
        document.documentElement.style.setProperty('--bg-main', isDark ? '#121212' : '#d4bbfc');
        document.documentElement.style.setProperty('--bg-container', isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)');
        document.documentElement.style.setProperty('--bg-dock', isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)');
        if ($('colorMain')) $('colorMain').value = isDark ? '#121212' : '#d4bbfc';
        if ($('colorContainer')) $('colorContainer').value = isDark ? '#1e1e1e' : '#ffffff';
        if ($('colorDock')) $('colorDock').value = isDark ? '#1e1e1e' : '#ffffff';
    }
}
darkModeMediaQuery.addEventListener('change', (e) => applySystemTheme(e.matches));

function cleanIconPath(iconPath) {
    if (!iconPath) return '';
    let cleaned = iconPath.replace(/\\/g, '/');
    if (cleaned.startsWith('http')) return cleaned;
    return cleaned.replace(/\/\//g, '/');
}

function sanitizeIconUrl(rawUrl) {
    if (!rawUrl) return '';
    let url = cleanIconPath(rawUrl);
    if (url.startsWith('http://')) url = url.replace('http://', 'https://');
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
        url = `${basePath}/${url}`;
    }
    return url;
}

function showToast(msg) { const t = $('toast'); if(!t) return; t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
function getVals(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch(e) { return def; } }
function setVals(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getIconStyles() {
    const mark = localStorage.getItem(ST_KEYS.mark) || '0';
    const sDir = localStorage.getItem(ST_KEYS.dir) || 'bottom';
    const radius = localStorage.getItem(ST_KEYS.radius) || '0';
    const sBlur = localStorage.getItem(ST_KEYS.blur) || '10';
    const sOff = localStorage.getItem(ST_KEYS.offset) || '10';
    let opRaw = parseFloat(localStorage.getItem(ST_KEYS.opacity));
    if (isNaN(opRaw)) opRaw = 30;
    const sOp = Math.max(0, Math.min(100, opRaw)) / 100;
    const stroke = localStorage.getItem(ST_KEYS.stroke) === 'true';
    let radCSS = radius === '1' ? '50%' : radius === '2' ? '12px' : '16px';
    let ox = sDir==='left'? -sOff : sDir==='right'? sOff : 0;
    let oy = sDir==='top'? -sOff : sDir==='bottom'? sOff : 0;
    let markBg = mark==='0'?'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.02))':mark==='1'?'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.3) 100%)':'rgba(0,0,0,0.1)';
    return { radCSS, stroke, boxShadow: `${ox}px ${oy}px ${sBlur}px rgba(0,0,0,${sOp})`, markBg };
}

function applyGlobalIconEffectsToSettingsBtn() {
    const styles = getIconStyles();
    const btn = $('settingsBtn');
    const overlay = $('settingMarkOverlay');
    if(btn) { btn.style.boxShadow = styles.boxShadow; btn.classList.toggle('vision-stroke', styles.stroke); }
    if(overlay) { overlay.style.borderRadius = styles.radCSS; overlay.style.background = styles.markBg; }

    const trashWrapper = $('trashIconWrapper');
    const trashOverlay = $('trashMarkOverlay');
    const trashImg = $('trashIconImg');
    if (trashWrapper) { trashWrapper.style.borderRadius = styles.radCSS; trashWrapper.style.boxShadow = styles.boxShadow; trashWrapper.classList.toggle('vision-stroke', styles.stroke); }
    if (trashImg) trashImg.style.borderRadius = styles.radCSS;
    if (trashOverlay) { trashOverlay.style.borderRadius = styles.radCSS; trashOverlay.style.background = styles.markBg; }
}

function applyBackgroundEffects() {
    const sDir = localStorage.getItem(ST_KEYS.bgDir) || 'bottom';
    const sBlur = localStorage.getItem(ST_KEYS.bgBlur) || '60';
    const sOff = localStorage.getItem(ST_KEYS.bgOffset) || '30';
    let bgOpRaw = parseFloat(localStorage.getItem(ST_KEYS.bgOpacity));
    if (isNaN(bgOpRaw)) bgOpRaw = 8;
    const sOp = Math.max(0, Math.min(100, bgOpRaw)) / 100;

    let ox = sDir==='left'? -sOff : sDir==='right'? sOff : 0;
    let oy = sDir==='top'? -sOff : sDir==='bottom'? sOff : 0;
    let shadowValue = `${ox}px ${oy}px ${sBlur}px rgba(0,0,0,${sOp})`;
    
    if (mainAppContainer) mainAppContainer.style.boxShadow = shadowValue;
    if(document.body.classList.contains('dock-active') && dockArea?.className.indexOf('none') === -1) dockArea.style.boxShadow = shadowValue;
}

function handleScreenResize() {
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    let paddingTopVal = isStandalone ? 'env(safe-area-inset-top, 44px)' : 'env(safe-area-inset-top, 50px)';
    document.body.style.paddingTop = `calc(${paddingTopVal} + 10px)`;
    if (mainAppContainer) mainAppContainer.style.maxHeight = `calc(100dvh - ${paddingTopVal} - env(safe-area-inset-bottom, 20px) - 90px)`;
}
window.addEventListener('resize', handleScreenResize);
window.addEventListener('orientationchange', handleScreenResize);

function closeDrawerSecure() { drawerWrapper?.classList.remove('open'); }

function createAppItem(id, data, isDockItem = false) {
    const div = document.createElement('div'); 
    div.className = 'app-item'; div.dataset.id = id; div.dataset.zone = isDockItem ? 'dock' : 'grid';
    
    let dName = getVals(ST_KEYS.name, {})[id] || data?.Name || 'App';
    let firstLetter = dName.charAt(0).toUpperCase();
    let iconSrc = sanitizeIconUrl(data?.icon);
    const styles = getIconStyles();

    div.innerHTML = `
        <div class="icon-wrapper ${styles.stroke ? 'vision-stroke' : ''}" style="border-radius:${styles.radCSS}; box-shadow:${styles.boxShadow};">
            <span class="fallback-text" style="display: none;">${firstLetter}</span>
            <img class="icon-img" style="border-radius:${styles.radCSS};" src="${iconSrc}" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; this.previousElementSibling.style.display='block';">
            <div class="mark-overlay" style="border-radius:${styles.radCSS}; background:${styles.markBg}"></div>
        </div>
        ${!isDockItem ? `<div class="app-info"><span class="app-name">${dName}</span></div>` : ''}
    `;

    div.onclick = () => {
        if (isDeleteMode) return;
        if (isFastRenameMode) openRenameModal(id, dName);
        else window.location.href = "shortcuts://run-shortcut?name=Open App Launcher&input=text&text=" + encodeURIComponent(id);
    };

    let startX = 0, startY = 0, isDragging = false, moved = false;
    
    div.addEventListener('touchstart', e => {
        if (!isDeleteMode) return;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        isDragging = true; moved = false;
        div.style.transition = 'none'; div.style.zIndex = '1000';
    }, {passive: true});

    div.addEventListener('touchmove', e => {
        if (!isDragging || !isDeleteMode) return;
        let currentX = e.touches[0].clientX; let currentY = e.touches[0].clientY;
        let diffX = currentX - startX; let diffY = currentY - startY;
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
            moved = true;
            div.style.transform = `translate(${diffX}px, ${diffY}px) scale(0.85)`;
            div.style.opacity = '0.8';
            const trash = $('deleteTrash');
            if (trash) {
                const trashRect = trash.getBoundingClientRect();
                const divRect = div.getBoundingClientRect();
                const divCenterX = divRect.left + divRect.width / 2;
                const divCenterY = divRect.top + divRect.height / 2;
                if (divCenterX >= trashRect.left && divCenterX <= trashRect.right &&
                    divCenterY >= trashRect.top && divCenterY <= trashRect.bottom) {
                    trash.classList.add('active');
                } else {
                    trash.classList.remove('active');
                }
            }
        }
    }, {passive: true});

    div.addEventListener('touchend', e => {
        if (!isDragging || !isDeleteMode) return;
        isDragging = false;
        $('deleteTrash')?.classList.remove('active');
        
        if (moved) {
            const trash = $('deleteTrash');
            if (trash) {
                const trashRect = trash.getBoundingClientRect();
                const divRect = div.getBoundingClientRect();
                const divCenterX = divRect.left + divRect.width / 2;
                const divCenterY = divRect.top + divRect.height / 2;
                if (divCenterX >= trashRect.left && divCenterX <= trashRect.right &&
                    divCenterY >= trashRect.top && divCenterY <= trashRect.bottom) {
                    let arr = getVals(isDockItem ? ST_KEYS.dock : ST_KEYS.app, []);
                    arr = arr.filter(itemId => itemId !== id);
                    setVals(isDockItem ? ST_KEYS.dock : ST_KEYS.app, arr);
                    renderGrid();
                    return;
                }
            }
        }
        div.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s';
        div.style.transform = ''; div.style.opacity = ''; div.style.zIndex = '';
    });

    return div;
}

function renderDock() {
    if(!dockArea) return;
    const style = localStorage.getItem(ST_KEYS.dockStyle) || 'none';
    dockArea.innerHTML = '';
    if (style === 'none') {
        document.body.classList.remove('dock-active'); dockArea.style.display = 'none'; closeDrawerSecure(); return;
    }
    document.body.classList.add('dock-active'); dockArea.style.display = 'flex';
    dockArea.className = 'dock-container dock-style-' + style;
    applyBackgroundEffects();
    
    const fragment = document.createDocumentFragment();
    let arr = getVals(ST_KEYS.dock, []).filter(id => Boolean(id) && appDatabase[id]).slice(0, MAX_DOCK_APPS);
    arr.forEach(id => fragment.appendChild(createAppItem(id, appDatabase[id], true)));

    if (arr.length < MAX_DOCK_APPS) {
        const addBtn = document.createElement('div'); addBtn.className = 'app-item';
        addBtn.innerHTML = `<div class="icon-wrapper" style="display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.2); border-radius:16px;"><span style="font-size:28px; color:#fff;">+</span></div>`;
        addBtn.onclick = () => { isAddingDock = true; currentLocalLimit = 12; renderModal(); };
        fragment.appendChild(addBtn);
    }

    const setBtn = document.createElement('div'); setBtn.className = 'app-item'; setBtn.dataset.id = 'sys_settings';
    const styles = getIconStyles();
    setBtn.innerHTML = `
        <div class="icon-wrapper ${styles.stroke ? 'vision-stroke' : ''}" style="border-radius:${styles.radCSS}; box-shadow:${styles.boxShadow}; background:transparent;" id="dockSetInner">
            <div class="mark-overlay" style="border-radius:${styles.radCSS}; background:${styles.markBg}"></div>
            <img src="icons/icon_setting.png" crossorigin="anonymous" referrerpolicy="no-referrer" onerror="this.outerHTML='⚙️'" style="width:100%; height:100%; object-fit:contain; position:relative; z-index:2; border-radius:${styles.radCSS};">
        </div>
    `;
    setBtn.onclick = () => {
        if(isDeleteMode) { toggleDeleteMode(); return; }
        if(drawerWrapper?.classList.contains('open')) closeDrawerSecure();
        else if(drawerWrapper && drawerContent) {
            const rect = setBtn.getBoundingClientRect();
            drawerWrapper.style.flexDirection = 'column-reverse';
            drawerContent.style.flexDirection = 'column-reverse';
            drawerWrapper.className = 'drawer-vertical'; 
            drawerWrapper.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
            drawerWrapper.style.left = (rect.left + rect.width / 2) + 'px';
            drawerWrapper.style.right = 'auto';
            drawerWrapper.style.transformOrigin = 'bottom center';
            drawerWrapper.style.transform = 'translateX(-50%) scale(0.5)';
            void drawerWrapper.offsetWidth; 
            drawerWrapper.classList.add('open');
        }
    };
    fragment.appendChild(setBtn);
    dockArea.appendChild(fragment);
}

function renderGrid() {
    if(!grid) return;
    grid.innerHTML = '';
    document.body.classList.toggle('hide-labels', localStorage.getItem(ST_KEYS.hideLab) === 'true');
    let rawList = getVals(ST_KEYS.app, []).filter(Boolean);
    let appList = rawList.filter(id => appDatabase[id]).slice(0, MAX_APPS);
    
    const fragment = document.createDocumentFragment();
    appList.forEach(id => fragment.appendChild(createAppItem(id, appDatabase[id])));
    
    if (appList.length < MAX_APPS) {
        let isEmpty = appList.length === 0;
        let addLabel = isEmpty ? (langData?.button?.add_first_app || 'Thêm ứng dụng') : (langData?.button?.add || 'Thêm');
        const addBtn = document.createElement('div'); addBtn.className = 'app-item';
        addBtn.innerHTML = `
            <div class="icon-wrapper ${isEmpty ? 'wiggle-effect' : ''}" style="display:flex; align-items:center; justify-content:center; border:2px dashed rgba(255,255,255,0.6); border-radius:16px; background:rgba(255,255,255,0.15);">
                <span style="font-size:32px; color:#4f46e5; font-weight:300;">+</span>
            </div>
            <div class="app-info"><span class="app-name">${addLabel}</span></div>
        `;
        addBtn.onclick = () => { isAddingDock = false; currentLocalLimit = 12; renderModal(); };
        fragment.appendChild(addBtn);
    }
    grid.appendChild(fragment);
    renderDock();
}

function toggleDeleteMode() {
    isDeleteMode = !isDeleteMode;
    document.body.classList.toggle('delete-mode', isDeleteMode);
    const delBtn = $('btnDelete');
    if (delBtn) delBtn.innerHTML = isDeleteMode ? '<span style="font-size:18px; color:#34c759;">✅</span>' : '<img src="icons/icon_delete.png" crossorigin="anonymous" referrerpolicy="no-referrer" onerror="this.outerHTML=\'🗑️\'" />';
    if (isDeleteMode) closeDrawerSecure();
    renderGrid();
}

function searchOnlineApps(query) {
    currentQuery = query;
    const ml = $('modalList');
    const btnMoreOnline = $('btnLoadMoreOnline');
    const btnMoreLocal = $('btnLoadMoreLocal');
    if(btnMoreLocal) btnMoreLocal.style.display = 'none';
    if (!query.trim()) { renderModalList(); return; }

    if(currentSearchLimit === 12 && ml) ml.innerHTML = '<div style="grid-column: span 4; text-align: center; color: var(--color-channel-name); padding: 20px;">🔍 Đang tải dữ liệu...</div>';
    if(btnMoreOnline) btnMoreOnline.style.display = 'none';

    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${currentStore}&entity=software&limit=${currentSearchLimit}`)
        .then(res => res.json())
        .then(data => {
            if(!ml) return;
            ml.innerHTML = '';
            if (!data.results || data.results.length === 0) {
                ml.innerHTML = '<div style="grid-column: span 4; text-align: center; color: #888; padding: 20px;">Không tìm thấy kết quả!</div>';
                return;
            }
            const fragment = document.createDocumentFragment();
            data.results.forEach(app => {
                const bundleId = app.bundleId;
                let appName = app.trackName.split(':')[0].split('-')[0].trim();
                const iconUrl = sanitizeIconUrl(app.artworkUrl100 || app.artworkUrl512);
                appDatabase[bundleId] = { Name: appName, icon: iconUrl };
                const item = document.createElement('div'); item.className = 'app-item';
                let firstLetter = appName.charAt(0).toUpperCase();
                item.innerHTML = `
                    <div class="icon-wrapper" style="width:64px; height:64px; border-radius:16px;">
                        <span class="fallback-text" style="color:#333; display:none;">${firstLetter}</span>
                        <img src="${iconUrl}" class="icon-img" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; this.previousElementSibling.style.display='block';">
                    </div>
                    <span class="app-name" style="margin-top:4px;">${appName}</span>
                `;
                item.onclick = () => selectAppToAdd(bundleId);
                fragment.appendChild(item);
            });
            ml.appendChild(fragment);
            if(data.results.length === currentSearchLimit && btnMoreOnline) btnMoreOnline.style.display = 'block';
        })
        .catch(() => { if (ml) ml.innerHTML = '<div style="grid-column: span 4; text-align: center; color: #ff3b30;">Lỗi kết nối App Store!</div>'; });
}

function selectAppToAdd(id) {
    let arr = getVals(isAddingDock ? ST_KEYS.dock : ST_KEYS.app, []).filter(savedId => Boolean(savedId) && appDatabase[savedId]); 
    let maxLimitMsg = (langData?.modal?.max_apps_limit || "Bạn chỉ có thể thêm tối đa {max} ứng dụng.").replace('{max}', isAddingDock ? MAX_DOCK_APPS : MAX_APPS);
    if(arr.length >= (isAddingDock ? MAX_DOCK_APPS : MAX_APPS)) return showToast(maxLimitMsg);
    if(arr.includes(id)) return showToast("Ứng dụng đã tồn tại!"); 
    arr.push(id); 
    setVals(isAddingDock ? ST_KEYS.dock : ST_KEYS.app, arr);

    let customApps = getVals(ST_KEYS.custom, {});
    if (!customApps[id] && appDatabase[id]) {
        customApps[id] = { Name: appDatabase[id].Name, icon: appDatabase[id].icon };
        setVals(ST_KEYS.custom, customApps);
    }

    $('addAppModal')?.classList.remove('active'); 
    isAddingDock = false; 
    renderGrid();
}

function renderModalList() {
    const ml = $('modalList'); if(!ml) return;
    ml.innerHTML = '';
    if($('btnLoadMoreOnline')) $('btnLoadMoreOnline').style.display = 'none';
    const btnMoreLocal = $('btnLoadMoreLocal');
    const used = [...getVals(ST_KEYS.app, []), ...getVals(ST_KEYS.dock, [])];
    const availableApps = Object.keys(appDatabase).filter(id => !used.includes(id));
    
    const fragment = document.createDocumentFragment();
    availableApps.slice(0, currentLocalLimit).forEach(id => {
        const item = document.createElement('div'); item.className = 'app-item';
        let dName = appDatabase[id].Name;
        let cleanIcon = sanitizeIconUrl(appDatabase[id].icon);
        let firstLetter = dName.charAt(0).toUpperCase();
        item.innerHTML = `
            <div class="icon-wrapper" style="width:64px; height:64px; border-radius:12px; box-shadow: var(--shadow-box);">
                <span class="fallback-text" style="color:#333; display:none;">${firstLetter}</span>
                <img src="${cleanIcon}" class="icon-img" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; this.previousElementSibling.style.display='block';">
            </div>
            <span style="display:block; font-size:10px; margin-top:6px; text-align:center; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding: 0 4px; box-sizing:border-box;">${dName}</span>
        `;
        item.onclick = () => selectAppToAdd(id);
        fragment.appendChild(item);
    });
    ml.appendChild(fragment);

    if(btnMoreLocal) {
        if(availableApps.length > currentLocalLimit) btnMoreLocal.style.display = 'block';
        else btnMoreLocal.style.display = 'none';
    }
}

function renderModal() {
    if($('appSearchInput')) $('appSearchInput').value = '';
    currentQuery = ''; currentLocalLimit = 12;
    renderModalList();
    $('addAppModal')?.classList.add('active');
}

function openRenameModal(id, oldName) {
    renameAppId = id;
    if($('renameInput')) $('renameInput').value = oldName;
    $('renameModal')?.classList.add('active');
    setTimeout(() => $('renameInput')?.focus(), 300);
}

function closeRenameModal() {
    $('renameModal')?.classList.remove('active');
    renameAppId = null;
}

function openSettings(modalId) { closeDrawerSecure(); $(modalId)?.classList.add('active'); }

function initColors() {
    let cMain = localStorage.getItem(ST_KEYS.cMain);
    let cCont = localStorage.getItem(ST_KEYS.cCont);
    let cDock = localStorage.getItem(ST_KEYS.cDock);
    if (cMain) { document.documentElement.style.setProperty('--bg-main', cMain); if($('colorMain')) $('colorMain').value = cMain; }
    if (cCont) { document.documentElement.style.setProperty('--bg-container', cCont + 'cc'); if($('colorContainer')) $('colorContainer').value = cCont; }
    if (cDock) { document.documentElement.style.setProperty('--bg-dock', cDock + 'cc'); if($('colorDock')) $('colorDock').value = cDock; }
}

function initUI() {
    isFastRenameMode = localStorage.getItem(ST_KEYS.fastRename) === 'true';
    if($('fastRenameToggle')) $('fastRenameToggle').checked = isFastRenameMode;
    if($('hapticSoundToggle')) $('hapticSoundToggle').checked = localStorage.getItem(ST_KEYS.haptic) !== 'false';
    
    initColors();
    handleScreenResize();

    if($('bgShadowBlurInput')) $('bgShadowBlurInput').value = localStorage.getItem(ST_KEYS.bgBlur) || '60';
    if($('bgShadowOffsetInput')) $('bgShadowOffsetInput').value = localStorage.getItem(ST_KEYS.bgOffset) || '30';
    if($('bgShadowOpacityInput')) $('bgShadowOpacityInput').value = localStorage.getItem(ST_KEYS.bgOpacity) || '8';
    
    let savedBgDir = localStorage.getItem(ST_KEYS.bgDir) || 'bottom';
    document.querySelectorAll('.bg-dir-btn').forEach(btn => { if (btn.dataset.dir === savedBgDir) btn.classList.add('active'); else btn.classList.remove('active'); });

    if($('colorMain')) $('colorMain').addEventListener('input', e => document.documentElement.style.setProperty('--bg-main', e.target.value));
    if($('colorContainer')) $('colorContainer').addEventListener('input', e => document.documentElement.style.setProperty('--bg-container', e.target.value + 'cc'));
    if($('colorDock')) $('colorDock').addEventListener('input', e => document.documentElement.style.setProperty('--bg-dock', e.target.value + 'cc'));

    const sBtn = $('settingsBtn');
    if(sBtn) sBtn.onclick = () => {
        if (isDeleteMode) { toggleDeleteMode(); return; }
        if(!drawerWrapper || !drawerContent) return;
        drawerWrapper.style.flexDirection = 'row'; drawerContent.style.flexDirection = 'row';
        drawerWrapper.className = 'drawer-horizontal';
        drawerWrapper.style.bottom = 'calc(30px + env(safe-area-inset-bottom, 20px))';
        drawerWrapper.style.right = '88px'; drawerWrapper.style.left = 'auto'; 
        drawerWrapper.style.transformOrigin = 'right center'; drawerWrapper.style.transform = 'scale(0.5)';
        void drawerWrapper.offsetWidth; drawerWrapper.classList.add('open');
    };
    if($('drawerClose')) $('drawerClose').onclick = closeDrawerSecure;

    const trashEl = $('deleteTrash');
    if (trashEl) trashEl.onclick = () => { if (isDeleteMode) toggleDeleteMode(); };

    if($('appSearchInput')) $('appSearchInput').oninput = (e) => {
        clearTimeout(searchTimeout); currentSearchLimit = 12;
        searchTimeout = setTimeout(() => searchOnlineApps(e.target.value), 400);
    };
    if($('storeToggleBtn')) $('storeToggleBtn').onclick = () => {
        currentStore = currentStore === 'vn' ? 'us' : 'vn';
        $('storeToggleBtn').innerText = currentStore.toUpperCase();
        currentSearchLimit = 12;
        if(currentQuery) searchOnlineApps(currentQuery);
    };
    if($('btnLoadMoreOnline')) $('btnLoadMoreOnline').onclick = () => { currentSearchLimit += 12; searchOnlineApps(currentQuery); };
    if($('btnLoadMoreLocal')) $('btnLoadMoreLocal').onclick = () => { currentLocalLimit += 12; renderModalList(); };

    if($('btnDelete')) $('btnDelete').onclick = () => { closeDrawerSecure(); toggleDeleteMode(); };
    if($('btnReset')) $('btnReset').onclick = () => { 
        // Dùng confirm thay thế để tránh lỗi
        if(confirm(langData?.messages?.reset_confirm || "Xoá sạch?")){ localStorage.clear(); location.reload(); }
    };
    if($('btnInfo')) $('btnInfo').onclick = () => { closeDrawerSecure(); $('infoModal')?.classList.add('active'); };
    if($('btnMail')) $('btnMail').onclick = () => window.open(socialData?.links?.email || 'mailto:', '_blank');
    if($('btnFollow')) $('btnFollow').onclick = () => window.open(socialData?.links?.social_follow || 'https://icloud.com', '_blank');
    if($('btnPlugin')) $('btnPlugin').onclick = () => { closeDrawerSecure(); window.open(socialData?.links?.plugin_shortcut || 'https://www.icloud.com/shortcuts', '_blank'); };
    if($('btnSettings')) $('btnSettings').onclick = () => openSettings('settingsModal');
    if($('openEffectsBtn')) $('openEffectsBtn').onclick = () => { $('settingsModal')?.classList.remove('active'); openSettings('effectModal'); };
    if($('openBgEffectsBtn')) $('openBgEffectsBtn').onclick = () => { $('settingsModal')?.classList.remove('active'); openSettings('bgEffectModal'); };
    if($('openDockBtn')) $('openDockBtn').onclick = () => { $('settingsModal')?.classList.remove('active'); openSettings('dockModal'); };
    if($('openLabelsBtn')) $('openLabelsBtn').onclick = () => { $('settingsModal')?.classList.remove('active'); openSettings('labelsModal'); };
    
    // Đóng tất cả modal chung
    document.querySelectorAll('.close-modal').forEach(btn => { 
        if(btn.id.includes('close') || btn.id.includes('Close')) btn.onclick = (e) => e.target.closest('.modal-overlay')?.classList.remove('active');
    });

    // Modal chống sập (Dùng ?. để không lỗi)
    $('closeOnboarding')?.addEventListener('click', () => $('onboardingModal')?.classList.remove('active'));
    $('renameCancelBtn')?.addEventListener('click', closeRenameModal);
    $('renameOkBtn')?.addEventListener('click', () => {
        let n = $('renameInput')?.value;
        if(renameAppId && n && n.trim()) {
            let dict = getVals(ST_KEYS.name, {}); dict[renameAppId] = n.trim(); setVals(ST_KEYS.name, dict); renderGrid();
        }
        closeRenameModal();
    });

    $('importCancelBtn')?.addEventListener('click', () => $('importModal')?.classList.remove('active'));
    $('importOkBtn')?.addEventListener('click', () => {
        let code = $('importTextArea')?.value;
        try {
            let d = JSON.parse(decodeURIComponent(atob(code)));
            if(d.apps) setVals(ST_KEYS.app, d.apps); if(d.dock) setVals(ST_KEYS.dock, d.dock); if(d.names) setVals(ST_KEYS.name, d.names);
            if(d.eff) { localStorage.setItem(ST_KEYS.mark, d.eff.mark||'0'); localStorage.setItem(ST_KEYS.radius, d.eff.rad||'0'); localStorage.setItem(ST_KEYS.dir, d.eff.dir||'bottom'); localStorage.setItem(ST_KEYS.blur, d.eff.blur||'10'); localStorage.setItem(ST_KEYS.offset, d.eff.off||'10'); localStorage.setItem(ST_KEYS.opacity, d.eff.op||'30'); localStorage.setItem(ST_KEYS.dockStyle, d.eff.dk||'none'); localStorage.setItem(ST_KEYS.stroke, d.eff.st||'false'); localStorage.setItem(ST_KEYS.hideLab, d.eff.hl||'false'); localStorage.setItem(ST_KEYS.bgDir, d.eff.bgDir||'bottom'); localStorage.setItem(ST_KEYS.bgBlur, d.eff.bgBlur||'60'); localStorage.setItem(ST_KEYS.bgOffset, d.eff.bgOff||'30'); localStorage.setItem(ST_KEYS.bgOpacity, d.eff.bgOp||'8'); localStorage.setItem(ST_KEYS.haptic, d.eff.hp||'true'); localStorage.setItem(ST_KEYS.cMain, d.eff.cMain||'#d4bbfc'); localStorage.setItem(ST_KEYS.cCont, d.eff.cCont||'#ffffff'); localStorage.setItem(ST_KEYS.cDock, d.eff.cDock||'#ffffff'); }
            $('settingsModal')?.classList.remove('active');
            $('importModal')?.classList.remove('active');
            showToast(langData?.messages?.toast_success || "Thành công!"); setTimeout(() => location.reload(), 1000);
        } catch(e) { alert(langData?.messages?.toast_error || "Có lỗi xảy ra!"); }
    });

    // Export và Import
    if($('exportBtn')) $('exportBtn').onclick = () => {
        const data = { apps: getVals(ST_KEYS.app,[]), dock: getVals(ST_KEYS.dock,[]), names: getVals(ST_KEYS.name,{}), eff: { mark: localStorage.getItem(ST_KEYS.mark), rad: localStorage.getItem(ST_KEYS.radius), dir: localStorage.getItem(ST_KEYS.dir), blur: localStorage.getItem(ST_KEYS.blur), off: localStorage.getItem(ST_KEYS.offset), op: localStorage.getItem(ST_KEYS.opacity), dk: localStorage.getItem(ST_KEYS.dockStyle), st: localStorage.getItem(ST_KEYS.stroke), hl: localStorage.getItem(ST_KEYS.hideLab), bgDir: localStorage.getItem(ST_KEYS.bgDir), bgBlur: localStorage.getItem(ST_KEYS.bgBlur), bgOff: localStorage.getItem(ST_KEYS.bgOffset), bgOp: localStorage.getItem(ST_KEYS.bgOpacity), hp: localStorage.getItem(ST_KEYS.haptic), cMain: localStorage.getItem(ST_KEYS.cMain), cCont: localStorage.getItem(ST_KEYS.cCont), cDock: localStorage.getItem(ST_KEYS.cDock) }};
        // Fallback copy
        const copyToClipboard = (text) => {
            const textArea = document.createElement('textarea');
            textArea.value = text; document.body.appendChild(textArea);
            textArea.select(); try { document.execCommand('copy'); } catch(err) {}
            document.body.removeChild(textArea);
            $('settingsModal')?.classList.remove('active');
            showToast(langData?.messages?.toast_copied || "Đã sao chép");
        };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(btoa(encodeURIComponent(JSON.stringify(data)))).then(() => {
                $('settingsModal')?.classList.remove('active');
                showToast(langData?.messages?.toast_copied || "Đã sao chép");
            }).catch(() => copyToClipboard(btoa(encodeURIComponent(JSON.stringify(data)))));
        } else copyToClipboard(btoa(encodeURIComponent(JSON.stringify(data))));
    };
    if($('importBtn')) $('importBtn').onclick = () => {
        $('settingsModal')?.classList.remove('active');
        $('importModal')?.classList.add('active');
        if($('importTextArea')) $('importTextArea').value = '';
    };

    // Các nút save hiệu ứng
    if($('saveBgEffectBtn')) $('saveBgEffectBtn').onclick = () => {
        let activeDir = document.querySelector('.bg-dir-btn.active');
        if(activeDir) localStorage.setItem(ST_KEYS.bgDir, activeDir.dataset.dir);
        let b = parseFloat($('bgShadowBlurInput')?.value) || 0;
        let o = parseFloat($('bgShadowOffsetInput')?.value) || 0;
        let op = parseFloat($('bgShadowOpacityInput')?.value);
        if(isNaN(op)) op = 8;

        localStorage.setItem(ST_KEYS.bgBlur, Math.max(0, b));
        localStorage.setItem(ST_KEYS.bgOffset, o);
        localStorage.setItem(ST_KEYS.bgOpacity, Math.max(0, Math.min(100, op)));

        let cMain = $('colorMain')?.value;
        if(cMain) {
            localStorage.setItem(ST_KEYS.cMain, cMain);
            document.documentElement.style.setProperty('--bg-main', cMain);
        }
        if($('colorContainer')) localStorage.setItem(ST_KEYS.cCont, $('colorContainer').value);
        if($('colorDock')) localStorage.setItem(ST_KEYS.cDock, $('colorDock').value);

        $('bgEffectModal')?.classList.remove('active'); 
        applyBackgroundEffects(); showToast(langData?.messages?.toast_saved || "Đã lưu thành công");
    };

    if($('saveEffectBtn')) $('saveEffectBtn').onclick = () => {
        if($('markStyle')) localStorage.setItem(ST_KEYS.mark, $('markStyle').value);
        if($('radiusStyle')) localStorage.setItem(ST_KEYS.radius, $('radiusStyle').value);
        if($('strokeToggle')) localStorage.setItem(ST_KEYS.stroke, $('strokeToggle').checked);
        let activeDir = document.querySelector('.dir-btn:not(.bg-dir-btn).active');
        if(activeDir) localStorage.setItem(ST_KEYS.dir, activeDir.dataset.dir);
        
        let b = parseFloat($('shadowBlurInput')?.value) || 0;
        let o = parseFloat($('shadowOffsetInput')?.value) || 0;
        let op = parseFloat($('shadowOpacityInput')?.value);
        if(isNaN(op)) op = 30;

        localStorage.setItem(ST_KEYS.blur, Math.max(0, b));
        localStorage.setItem(ST_KEYS.offset, o);
        localStorage.setItem(ST_KEYS.opacity, Math.max(0, Math.min(100, op)));
        
        $('effectModal')?.classList.remove('active'); 
        applyGlobalIconEffectsToSettingsBtn(); renderGrid(); showToast(langData?.messages?.toast_saved || "Đã lưu thành công");
    };

    if($('saveDockBtn')) $('saveDockBtn').onclick = () => {
        let style = 'none';
        if($('dockGlassToggle')?.checked) style = 'glass';
        else if($('dockWoodToggle')?.checked) style = 'wood';
        else if($('dockBlurToggle')?.checked) style = 'blur';
        localStorage.setItem(ST_KEYS.dockStyle, style);
        $('dockModal')?.classList.remove('active'); renderGrid(); showToast(langData?.messages?.toast_saved || "Đã lưu thành công");
    };

    if($('saveLabelsBtn')) $('saveLabelsBtn').onclick = () => {
        if($('hideLabelsToggle')) localStorage.setItem(ST_KEYS.hideLab, $('hideLabelsToggle').checked);
        if($('hapticSoundToggle')) localStorage.setItem(ST_KEYS.haptic, $('hapticSoundToggle').checked);
        if($('fastRenameToggle')) isFastRenameMode = $('fastRenameToggle').checked; 
        localStorage.setItem(ST_KEYS.fastRename, isFastRenameMode);
        $('labelsModal')?.classList.remove('active'); renderGrid(); showToast(langData?.messages?.toast_saved || "Đã lưu thành công");
    };

    renderGrid();
    
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone) setTimeout(() => { $('onboardingModal')?.classList.add('active'); }, 3000); // Giảm còn 3 giây
}

// Khởi động
Promise.all([
    fetch(basePath + '/db.json').then(res => res.json()).catch(() => ({})),
    fetch(basePath + '/system-app.json').then(res => res.json()).catch(() => ({})),
    fetch(basePath + '/social.json').then(res => res.json()).catch(() => ({})),
    resolveLanguage()
]).then(([db, sysApp, social]) => {
    let customApps = getVals(ST_KEYS.custom, {});
    appDatabase = { ...FALLBACK_DB, ...db, ...sysApp, ...customApps }; 
    socialData = social?.links ? social : socialData;
    applySystemTheme(darkModeMediaQuery.matches);
    applyLanguage();
    applyBackgroundEffects();
    applyGlobalIconEffectsToSettingsBtn();
    initUI();
});