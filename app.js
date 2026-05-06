const SUPABASE_URL = 'https://tpbontlgjeathujbjujj.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwYm9udGxnamVhdGh1amJqdWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODA4NDAsImV4cCI6MjA5MzY1Njg0MH0.igRLknfkj1WNbsJ9yVuGRdXBVLMDlexyM7uphRJoH4o';

let userEmail = localStorage.getItem('flow_email') || prompt("E-mail para sincronizar:");
if (userEmail) localStorage.setItem('flow_email', userEmail);

let habits = [];
let habitsLogs = [];
let activeTimer = null;

async function syncCloud(method = 'GET') {
    if (!userEmail) return;
    const headers = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
    
    if (method === 'GET') {
        const res = await fetch(`${SUPABASE_URL}/habits_sync?user_email=eq.${userEmail}`, { headers });
        const data = await res.json();
        if (data.length > 0) {
            habits = data[0].habits_data;
            habitsLogs = data[0].logs_data;
            checkDayReset(data[0].last_date);
            render();
        }
    } else {
        await fetch(`${SUPABASE_URL}/habits_sync?user_email=eq.${userEmail}`, {
            method: 'POST',
            headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                user_email: userEmail,
                habits_data: habits,
                logs_data: habitsLogs,
                last_date: new Date().toLocaleDateString('pt-BR')
            })
        });
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    const ball = document.getElementById('toggle-ball');
    const icon = document.getElementById('toggle-icon');
    const text = document.getElementById('theme-text');
    
    if (isDark) {
        ball.className = 'toggle-left'; icon.innerText = '🌙'; text.innerText = 'Theme Dark';
        localStorage.setItem('theme', 'dark');
    } else {
        ball.className = 'toggle-right'; icon.innerText = '☀️'; text.innerText = 'Theme Light';
        localStorage.setItem('theme', 'light');
    }
}

function checkDayReset(lastDate) {
    const today = new Date().toLocaleDateString('pt-BR');
    if (lastDate && lastDate !== today) {
        habitsLogs.push({ date: lastDate, data: JSON.parse(JSON.stringify(habits)) });
        habits.forEach(h => { h.done = false; h.completedAt = null; h.remaining = null; });
    }
}

function render() {
    const list = document.getElementById('habits-list');
    list.innerHTML = '';
    const select = document.getElementById('h-position');
    select.innerHTML = '<option value="end">No final</option>';

    habits.forEach((h, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = `Antes de: ${h.name}`;
        select.appendChild(opt);

        const div = document.createElement('div');
        div.className = `habit ${h.done ? 'done' : ''}`;
        div.draggable = true;

        div.innerHTML = `
            <div class="habit-header">
                <div class="habit-info">
                    <span class="habit-name">${h.name} ${h.done ? '✅' : ''}</span>
                    <div class="habit-details">
                        ${h.time ? `<div class="detail-item" title="Horário sugerido!">🕒 ${h.time}</div>` : ''}
                        ${h.completedAt ? `<div class="detail-item" title="Feito neste horário!">✅ ${h.completedAt}</div>` : ''}
                        ${h.duration || h.remaining ? `<div class="detail-item"><span class="timer-badge">${h.remaining ? formatTime(h.remaining) : h.duration+'min'}</span></div>` : ''}
                    </div>
                </div>
                <div class="actions">
                    <button class="btn-edit" onclick="editHabit(${i})">Editar</button>
                    ${h.done ? `<button class="btn-undo" onclick="undo(${i})">Desfazer</button>` : `<button class="btn-done" onclick="complete(${i})">Concluir</button>`}
                    <button class="btn-delete" onclick="deleteHabit(${i})">Excluir</button>
                </div>
            </div>
        `;
        div.ondragstart = () => { window.draggedIdx = i; };
        div.ondragover = e => e.preventDefault();
        div.ondrop = () => {
            const item = habits.splice(window.draggedIdx, 1)[0];
            habits.splice(i, 0, item);
            saveAndRefresh();
        };
        list.appendChild(div);
    });
}

function handleSave() {
    const name = document.getElementById('h-name').value;
    const dur = document.getElementById('h-min').value;
    const time = document.getElementById('h-time').value;
    const editIdx = document.getElementById('edit-index').value;
    const pos = document.getElementById('h-position').value;

    if (!name) return alert("Nome obrigatório");

    if (editIdx !== "") {
        habits[editIdx] = { ...habits[editIdx], name, duration: dur ? parseInt(dur) : null, time: time || null };
    } else {
        const h = { name, duration: dur ? parseInt(dur) : null, time: time || null, done: false, remaining: null, completedAt: null };
        if (pos === 'end') habits.push(h); else habits.splice(parseInt(pos), 0, h);
    }
    saveAndRefresh();
    clearForm();
}

function complete(i) {
    const hora = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    let res = confirm(`Registrar agora (${hora})?`);
    let final = res ? hora : prompt("Horário (HH:MM):", hora);
    if (!final) return;

    habits[i].done = true;
    habits[i].completedAt = final;
    clearInterval(activeTimer);
    if (habits[i+1] && habits[i+1].duration) startCountdown(habits[i+1]);
    saveAndRefresh();
}

function startCountdown(h) {
    h.remaining = h.duration * 60;
    activeTimer = setInterval(() => {
        if (h.remaining > 0) { h.remaining--; render(); }
        else { clearInterval(activeTimer); alert("Alarme: " + h.name); }
    }, 1000);
}

function undo(i) { if(confirm("Desfazer?")) { habits[i].done = false; habits[i].completedAt = null; saveAndRefresh(); } }
function deleteHabit(i) { if(confirm("Apagar hábito?")) { habits.splice(i, 1); saveAndRefresh(); } }

function editHabit(i) {
    const h = habits[i];
    document.getElementById('h-name').value = h.name;
    document.getElementById('h-min').value = h.duration || "";
    document.getElementById('h-time').value = h.time || "";
    document.getElementById('edit-index').value = i;
    document.getElementById('form-title').innerText = "Editando: " + h.name;
    document.getElementById('anchor-form').scrollIntoView({behavior:'smooth'});
}

function clearForm() {
    document.getElementById('h-name').value = ""; document.getElementById('h-min').value = "";
    document.getElementById('h-time').value = ""; document.getElementById('edit-index').value = "";
    document.getElementById('form-title').innerText = "Novo Hábito";
}

function saveAndRefresh() { render(); syncCloud('POST'); }
function formatTime(s) { return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}s`; }

if (localStorage.getItem('theme') === 'dark') toggleTheme();
syncCloud('GET');