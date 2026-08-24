// script.js
/* =========================================
   [QUÂN SƯ AI] JAVASCRIPT V5 - Xử lý logic mạnh mẽ hơn
   ========================================= */

const FALLBACK_DB = { "vn.com.vng.zingalo": {"Name":"Zalo","icon":"https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a6/fd/de/a6fdde29-8d09-cd61-d8e9-bd5293b9cf21/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/100x100bb.png"} };
let appDatabase = {}, socialData = { links: { email: '', social_follow: '', plugin_shortcut: '' } };
const basePath = '.';

const ST_KEYS = { app: 'myAppList', name: 'myAppNames', dock: 'myDockApps', mark: 'effectMarkStyle', radius: 'effectRadiusStyle', dir: 'effectShadowDirection', blur: 'effectShadowBlur', offset: 'effectShadowOffset', opacity: 'effectShadowOpacity', dockStyle: 'dockStyle', stroke: 'effectStroke', hideLab: 'hideLabels' };
const MAX_APPS = 12, MAX_DOCK_APPS = 3;
let isDeleteMode = false, isAddingDock = false, isFastRenameMode = false;
let isDragging = false, dragClone = null, draggedAppId = null, dragType = null;

const grid = document.getElementById('appGrid'), dockArea = document.getElementById('dockArea'), drawerWrapper = document.getElementById('drawerWrapper');
const DEFAULT_APPS = ['com.deepseek.chat', 'vn.com.vng.zingalo', 'com.facebook.Facebook', 'com.apple.mobilesafari'];

// Load dữ liệu đồng bộ
Promise.all([
    fetch(basePath + '/db.json').then(res => res.json()).catch(() => FALLBACK_DB),
    fetch(basePath + '/system-app.json').then(res => res.json()).catch(() => ({})),
    fetch(basePath + '/social.json').then(res => res.json()).catch(() => socialData)
]).then(([db, sysApp, social]) => {
    appDatabase = { ...db, ...sysApp }; socialData = social || socialData;
    initUI();
});

function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }

function closeDrawerSecure() { 
    drawerWrapper.classList.remove('open'); 
    setTimeout(() => drawerWrapper.style.display = 'none', 250);
    if (document.body.classList.contains('dock-active')) {
        const dockSetBtn = document.getElementById('dockSetInner');
        if(dockSetBtn) dockSetBtn.innerHTML = `<img src="icons/icon_setting.png" onerror="this.outerHTML='⚙️'" style="width:100%; height:100%; object-fit:contain;">`;
    } else if (!isDeleteMode) {
        document.getElementById('settingsBtn').style.display = 'flex';
    }
}

function getVals(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch(e) { return def; } }
function setVals(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function swapApps(id1, id2, zone) {
    let arr = getVals(zone === 'dock' ? ST_KEYS.dock : ST_KEYS.app, zone === 'dock' ? [] : DEFAULT_APPS);
    let i1 = arr.indexOf(id1), i2 = arr.indexOf(id2);
    if(i1 > -1 && i2 > -1) { [arr[i1], arr[i2]] = [arr[i2], arr[i1]]; setVals(zone === 'dock' ? ST_KEYS.dock : ST_KEYS.app, arr); zone === 'dock' ? renderDock() : renderGrid(); }
}

function deleteApp(id) {
    setVals(ST_KEYS.app, getVals(ST_KEYS.app, []).filter(i => i !== id));
    setVals(ST_KEYS.dock, getVals(ST_KEYS.dock, []).filter(i => i !== id));
    renderGrid();
}

// Tạo phần tử app với accessibility đầy đủ
function createAppItem(id, data, isDockItem = false) {
    const div = document.createElement('div'); 
    div.className = 'app-item'; 
    div.dataset.id = id; 
    div.dataset.zone = isDockItem ? 'dock' : 'grid';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Mở ứng dụng ${data.Name}`);
    
    let dName = getVals(ST_KEYS.name, {})[id] || data.Name;
    let iconSrc = data.icon && !data.icon.startsWith('http') && !data.icon.startsWith('/') ? basePath + '/' + data.icon : data.icon;
    
    const mark = localStorage.getItem(ST_KEYS.mark) || '0', sDir = localStorage.getItem(ST_KEYS.dir) || 'bottom', radius = localStorage.getItem(ST_KEYS.radius) || '0';
    const sBlur = localStorage.getItem(ST_KEYS.blur) || '10', sOff = localStorage.getItem(ST_KEYS.offset) || '10', sOp = (localStorage.getItem(ST_KEYS.opacity) || '30') / 100;
    const stroke = localStorage.getItem(ST_KEYS.stroke) === 'true';

    let radCSS = radius === '1' ? '50%' : radius === '2' ? '12px' : '16px';
    let ox = sDir==='left'? -sOff : sDir==='right'? sOff : 0;
    let oy = sDir==='top'? -sOff : sDir==='bottom'? sOff : 0;

    div.innerHTML = `
        <div class="icon-wrapper ${stroke ? 'vision-stroke' : ''}" style="border-radius:${radCSS}; box-shadow:${ox}px ${oy}px ${sBlur}px rgba(0,0,0,${sOp}); width:60px; height:60px;">
            <img class="icon-img" style="border-radius:${radCSS};" src="${iconSrc}" onerror="this.style.display='none'">
            <span class="fallback-text"></span>
            <div class="mark-overlay" style="border-radius:${radCSS}; background:${mark==='0'?'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.02))':mark==='1'?'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.3) 100%)':'rgba(0,0,0,0.1)'}"></div>
            ${isDeleteMode ? '<div class="delete-icon" role="button" aria-label="Xóa ứng dụng">✕</div>' : ''}
        </div>
        ${!isDockItem ? `<div class="app-info"><span class="app-name">${dName}</span></div>` : ''}
    `;

    // Xử lý sự kiện bàn phím
    div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            div.click();
        }
    });

    if(isDeleteMode) {
        div.querySelector('.delete-icon').onclick = (e) => { e.stopPropagation(); deleteApp(id); };
    } else {
        div.onclick = () => isFastRenameMode ? renameApp(id, dName) : launchShortcut("Open App Launcher", id);
    }
    return div;
}

// Hàm gọi Shortcut an toàn: kiểm tra focus sau 500ms
function launchShortcut(name, input) {
    let url = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=${encodeURIComponent(input)}`;
    // Lưu lại trạng thái trước khi chuyển trang
    window.location.href = url;

    setTimeout(() => {
        // Nếu vẫn còn focus (không chuyển trang) => chưa cài Shortcuts hoặc lỗi
        if (document.hasFocus()) {
            showToast("Bạn cần cài đặt ứng dụng Phím tắt!");
        }
    }, 500);
}

// Hỗ trợ x-callback-url (nhận dữ liệu về) - Có thể bổ sung thêm logic xử lý khi cần
// Cấu hình Shortcut trả về: dùng action "URL Encode" rồi mở URL dạng snowboard://callback?data=...

function renderDock() {
    const style = localStorage.getItem(ST_KEYS.dockStyle) || 'none';
    dockArea.innerHTML = '';
    if (style === 'none') {
        document.body.classList.remove('dock-active'); dockArea.style.display = 'none'; closeDrawerSecure(); return;
    }
    document.body.classList.add('dock-active'); dockArea.style.display = 'flex'; document.getElementById('settingsBtn').style.display = 'none';
    dockArea.className = 'dock-container dock-style-' + style;
    
    const main = getVals(ST_KEYS.app, DEFAULT_APPS);
    const dApps = getVals(ST_KEYS.dock, []).filter(id => !main.includes(id)).slice(0, MAX_DOCK_APPS);
    dApps.forEach(id => { if(appDatabase[id]) dockArea.appendChild(createAppItem(id, appDatabase[id], true)); });

    if (dApps.length < MAX_DOCK_APPS) {
        const addBtn = document.createElement('div'); 
        addBtn.className = 'app-item';
        addBtn.setAttribute('role', 'button');
        addBtn.setAttribute('tabindex', '0');
        addBtn.setAttribute('aria-label', 'Thêm ứng dụng vào dock');
        addBtn.innerHTML = `<div class="icon-wrapper" style="width:60px; height:60px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.2); border-radius:16px;"><span style="font-size:28px; color:#fff;">+</span></div>`;
        addBtn.onclick = () => { isAddingDock = true; renderModal(); };
        dockArea.appendChild(addBtn);
    }

    const setBtn = document.createElement('div'); 
    setBtn.className = 'app-item'; 
    setBtn.dataset.id = 'sys_settings';
    setBtn.setAttribute('role', 'button');
    setBtn.setAttribute('tabindex', '0');
    setBtn.setAttribute('aria-label', 'Mở menu cài đặt');
    
    // Lấy hiệu ứng hiện tại để áp dụng cho nút cài đặt
    const mark = localStorage.getItem(ST_KEYS.mark) || '0', sDir = localStorage.getItem(ST_KEYS.dir) || 'bottom', radius = localStorage.getItem(ST_KEYS.radius) || '0';
    const sBlur = localStorage.getItem(ST_KEYS.blur) || '10', sOff = localStorage.getItem(ST_KEYS.offset) || '10', sOp = (localStorage.getItem(ST_KEYS.opacity) || '30') / 100;
    const stroke = localStorage.getItem(ST_KEYS.stroke) === 'true';
    let radCSS = radius === '1' ? '50%' : radius === '2' ? '12px' : '16px';
    let ox = sDir==='left'? -sOff : sDir==='right'? sOff : 0;
    let oy = sDir==='top'? -sOff : sDir==='bottom'? sOff : 0;

    setBtn.innerHTML = `
        <div class="icon-wrapper ${stroke ? 'vision-stroke' : ''}" style="border-radius:${radCSS}; box-shadow:${ox}px ${oy}px ${sBlur}px rgba(0,0,0,${sOp}); width:60px; height:60px; background:transparent;" id="dockSetInner">
            ${isDeleteMode ? '<span style="font-size:24px; color:#34c759; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">✅</span>' : '<img src="icons/icon_setting.png" onerror="this.outerHTML=\'⚙️\'" style="width:100%; height:100%; object-fit:contain;">'}
        </div>
    `;
    setBtn.onclick = () => {
        if(isDeleteMode) { toggleDeleteMode(); return; }
        if(drawerWrapper.classList.contains('open')) closeDrawerSecure();
        else {
            drawerWrapper.style.display = 'flex'; void drawerWrapper.offsetWidth; drawerWrapper.classList.add('open');
            document.getElementById('dockSetInner').innerHTML = '<span style="font-size:24px; color:#fff; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">✕</span>';
        }
    };
    dockArea.appendChild(setBtn);
}

function renderGrid() {
    grid.innerHTML = '';
    document.body.classList.toggle('hide-labels', localStorage.getItem(ST_KEYS.hideLab) === 'true');
    getVals(ST_KEYS.app, DEFAULT_APPS).slice(0, MAX_APPS).forEach(id => { if(appDatabase[id]) grid.appendChild(createAppItem(id, appDatabase[id])); });
    
    if (getVals(ST_KEYS.app, []).length < MAX_APPS) {
        const addBtn = document.createElement('div'); 
        addBtn.className = 'app-item';
        addBtn.setAttribute('role', 'button');
        addBtn.setAttribute('tabindex', '0');
        addBtn.setAttribute('aria-label', 'Thêm ứng dụng mới');
        addBtn.innerHTML = `<div class="icon-wrapper" style="width:60px; height:60px; display:flex; align-items:center; justify-content:center; border:2px dashed rgba(255,255,255,0.6); border-radius:16px;"><span style="font-size:28px; color:#4f46e5;">+</span></div><div class="app-info"><span class="app-name">Thêm</span></div>`;
        addBtn.onclick = () => { isAddingDock = false; renderModal(); };
        grid.appendChild(addBtn);
    }
    renderDock();
}

function toggleDeleteMode() {
    isDeleteMode = !isDeleteMode; renderGrid();
    document.getElementById('btnDelete').innerHTML = isDeleteMode ? '<span style="font-size:18px; color:#34c759;">✅</span>' : '<img src="icons/icon_delete.png" onerror="this.outerHTML=\'🗑️\'" />';
}

function renderModal() {
    const ml = document.getElementById('modalList'); ml.innerHTML = '';
    const used = [...getVals(ST_KEYS.app, []), ...getVals(ST_KEYS.dock, [])];
    Object.keys(appDatabase).filter(id => !used.includes(id)).forEach(id => {
        const item = document.createElement('div'); 
        item.className = 'app-item';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Thêm ${appDatabase[id].Name}`);
        item.innerHTML = `<div class="icon-wrapper" style="width:50px; height:50px; border-radius:12px;"><img src="${appDatabase[id].icon}" class="icon-img" onerror="this.style.display='none'"></div><span style="font-size:10px; margin-top:4px;">${appDatabase[id].Name}</span>`;
        item.onclick = () => {
            let arr = getVals(isAddingDock ? ST_KEYS.dock : ST_KEYS.app, []);
            if(arr.length >= (isAddingDock ? MAX_DOCK_APPS : MAX_APPS)) return showToast('Đã đầy rổ!');
            arr.push(id); setVals(isAddingDock ? ST_KEYS.dock : ST_KEYS.app, arr);
            document.getElementById('addAppModal').classList.remove('active'); isAddingDock = false; renderGrid();
        };
        ml.appendChild(item);
    });
    document.getElementById('addAppModal').classList.add('active');
}

function renameApp(id, old) {
    let n = prompt('Nhập tên mới:', old);
    if(n !== null) { let dict = getVals(ST_KEYS.name, {}); n.trim() ? dict[id] = n.trim() : delete dict[id]; setVals(ST_KEYS.name, dict); renderGrid(); }
}

function openSettings(modalId) { closeDrawerSecure(); document.getElementById(modalId).classList.add('active'); }

function initUI() {
    document.getElementById('settingsBtn').onclick = () => {
        document.getElementById('settingsBtn').style.display='none';
        drawerWrapper.style.display='flex'; void drawerWrapper.offsetWidth; drawerWrapper.classList.add('open');
    };
    document.getElementById('drawerClose').onclick = closeDrawerSecure;

    document.getElementById('btnDelete').onclick = toggleDeleteMode;
    document.getElementById('btnReset').onclick = () => { if(confirm("Khôi phục mặc định?")){ localStorage.clear(); location.reload(); }};
    
    document.getElementById('btnInfo').onclick = () => { closeDrawerSecure(); document.getElementById('infoModal').classList.add('active'); };
    document.getElementById('btnMail').onclick = () => window.open(socialData.links?.email || 'mailto:sentechtips@gmail.com', '_blank');
    document.getElementById('btnFollow').onclick = () => window.open(socialData.links?.social_follow || 'https://icloud.com', '_blank');
    document.getElementById('btnInfoDetails').onclick = () => { alert("Snowboard v6.0\nPhát hành bởi: Sentechtipsvn"); document.getElementById('infoModal').classList.remove('active'); };
    document.getElementById('closeInfoModal').onclick = () => document.getElementById('infoModal').classList.remove('active');

    document.getElementById('btnPlugin').onclick = () => { closeDrawerSecure(); window.open(socialData.links?.plugin_shortcut || 'https://www.icloud.com/shortcuts', '_blank'); };
    document.getElementById('btnSettings').onclick = () => openSettings('settingsModal');

    document.getElementById('openEffectsBtn').onclick = () => { document.getElementById('settingsModal').classList.remove('active'); openSettings('effectModal'); };
    document.getElementById('openDockBtn').onclick = () => { document.getElementById('settingsModal').classList.remove('active'); openSettings('dockModal'); };
    document.getElementById('openLabelsBtn').onclick = () => { document.getElementById('settingsModal').classList.remove('active'); openSettings('labelsModal'); };
    
    document.querySelectorAll('.dir-btn').forEach(btn => btn.onclick = () => { document.querySelectorAll('.dir-btn').forEach(b => b.style.border='none'); btn.style.border='2px solid #0071e3'; btn.classList.add('active'); });

    document.getElementById('saveEffectBtn').onclick = () => {
        localStorage.setItem(ST_KEYS.mark, document.getElementById('markStyle').value);
        localStorage.setItem(ST_KEYS.radius, document.getElementById('radiusStyle').value);
        localStorage.setItem(ST_KEYS.stroke, document.getElementById('strokeToggle').checked);
        let activeDir = document.querySelector('.dir-btn.active');
        if(activeDir) localStorage.setItem(ST_KEYS.dir, activeDir.dataset.dir);
        localStorage.setItem(ST_KEYS.blur, document.getElementById('shadowBlurInput').value);
        localStorage.setItem(ST_KEYS.offset, document.getElementById('shadowOffsetInput').value);
        localStorage.setItem(ST_KEYS.opacity, document.getElementById('shadowOpacityInput').value);
        document.getElementById('effectModal').classList.remove('active'); renderGrid(); showToast("Đã lưu hiệu ứng");
    };

    document.getElementById('saveDockBtn').onclick = () => {
        let style = 'none';
        if(document.getElementById('dockGlassToggle').checked) style = 'glass';
        else if(document.getElementById('dockWoodToggle').checked) style = 'wood';
        else if(document.getElementById('dockBlurToggle').checked) style = 'blur';
        localStorage.setItem(ST_KEYS.dockStyle, style);
        document.getElementById('dockModal').classList.remove('active'); renderGrid(); showToast("Đã lưu Dock");
    };

    document.getElementById('saveLabelsBtn').onclick = () => {
        localStorage.setItem(ST_KEYS.hideLab, document.getElementById('hideLabelsToggle').checked);
        isFastRenameMode = document.getElementById('fastRenameToggle').checked;
        document.getElementById('labelsModal').classList.remove('active'); renderGrid(); showToast("Đã lưu tùy chọn tên");
    };

    document.querySelectorAll('.close-modal').forEach(btn => { if(btn.innerText.includes('Đóng') || btn.innerText.includes('Huỷ')) btn.onclick = (e) => e.target.closest('.modal-overlay').classList.remove('active'); });

    document.getElementById('exportBtn').onclick = () => {
        const data = { apps: getVals(ST_KEYS.app,[]), dock: getVals(ST_KEYS.dock,[]), names: getVals(ST_KEYS.name,{}), eff: { mark: localStorage.getItem(ST_KEYS.mark), rad: localStorage.getItem(ST_KEYS.radius), dir: localStorage.getItem(ST_KEYS.dir), blur: localStorage.getItem(ST_KEYS.blur), off: localStorage.getItem(ST_KEYS.offset), op: localStorage.getItem(ST_KEYS.opacity), dk: localStorage.getItem(ST_KEYS.dockStyle), st: localStorage.getItem(ST_KEYS.stroke), hl: localStorage.getItem(ST_KEYS.hideLab) }};
        navigator.clipboard.writeText(btoa(encodeURIComponent(JSON.stringify(data)))).then(() => { document.getElementById('settingsModal').classList.remove('active'); showToast("Cấu hình đã lưu vào bảng nhớ tạm"); });
    };
    document.getElementById('importBtn').onclick = () => {
        let code = prompt("Dán mã cấu hình của bạn vào đây:"); if(!code) return;
        try {
            let d = JSON.parse(decodeURIComponent(atob(code)));
            if(d.apps) setVals(ST_KEYS.app, d.apps); if(d.dock) setVals(ST_KEYS.dock, d.dock); if(d.names) setVals(ST_KEYS.name, d.names);
            if(d.eff) { localStorage.setItem(ST_KEYS.mark, d.eff.mark||'0'); localStorage.setItem(ST_KEYS.radius, d.eff.rad||'0'); localStorage.setItem(ST_KEYS.dir, d.eff.dir||'bottom'); localStorage.setItem(ST_KEYS.blur, d.eff.blur||'10'); localStorage.setItem(ST_KEYS.offset, d.eff.off||'10'); localStorage.setItem(ST_KEYS.opacity, d.eff.op||'30'); localStorage.setItem(ST_KEYS.dockStyle, d.eff.dk||'none'); localStorage.setItem(ST_KEYS.stroke, d.eff.st||'false'); localStorage.setItem(ST_KEYS.hideLab, d.eff.hl||'false'); }
            document.getElementById('settingsModal').classList.remove('active'); showToast("Đã nhập cấu hình thành công!"); setTimeout(() => location.reload(), 1000);
        } catch(e) { alert("Mã cấu hình không hợp lệ!"); }
    };

    renderGrid();
}