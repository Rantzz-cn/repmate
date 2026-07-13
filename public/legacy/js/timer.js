import { formatTime } from './ui.js';
let timer = null, left = 0, paused = false, exerciseName = 'Next set';
function draw() {
  const panel = document.querySelector('#timer-float');
  if (left <= 0) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  panel.innerHTML = `<div class="rest-timer__summary"><div><span>Rest Timer</span><small>${exerciseName}</small></div><strong>${formatTime(left)}</strong></div><div class="rest-timer__actions"><button type="button" data-timer="minus">−30</button><button type="button" data-timer="toggle">${paused ? 'Resume' : 'Pause'}</button><button type="button" data-timer="plus">+30</button><button type="button" data-timer="skip">Skip</button></div>`;
}
export function startTimer(seconds, label = 'Next set') {
  clearInterval(timer); left = seconds; exerciseName = label; paused = false; draw();
  timer = setInterval(() => { if (!paused && --left <= 0) { clearInterval(timer); draw(); if (navigator.vibrate) navigator.vibrate([180,80,180]); if (Notification.permission === 'granted') new Notification('Rest complete',{body:'Time for your next set.'}); } else draw(); },1000);
}
document.addEventListener('click',(event) => { const action=event.target.dataset.timer; if(!action)return; if(action==='plus')left+=30; if(action==='minus')left=Math.max(0,left-30); if(action==='toggle')paused=!paused; if(action==='skip')left=0; draw(); });
