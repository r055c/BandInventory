// Sign-in, first-time setup and "can't reach the server" screens for cloud deployments.
import * as S from './store.js';
import { esc } from './util.js';

export function showGate(app, { stage, info }) {
  return new Promise((resolve) => {
    const setup = stage === 'setup';
    const name = (info && info.bandName) || '';
    const logo = info && info.logo;
    app.className = 'shell';
    if (stage === 'offline') {
      app.innerHTML = `<main class="page" style="justify-content:center;text-align:center">
        <h1 class="title-xl">Can't reach the server</h1>
        <p class="muted">Check your connection and try again. Once you have signed in on this device, the app keeps working offline.</p>
        <button class="btn btn-primary" id="retry">Try again</button></main>`;
      app.querySelector('#retry').addEventListener('click', () => location.reload());
      return;
    }
    app.innerHTML = `<main class="page" style="justify-content:center">
      <div class="stack" style="gap:18px">
        <div style="text-align:center">
          ${logo ? `<img class="logo-lg" style="margin:0 auto 12px;width:84px;height:84px;border-radius:42px" src="${esc(logo)}" alt="">` : ''}
          <h1 class="title-xl">${setup ? 'Set up your band' : esc(name || 'Band Kit')}</h1>
          <p class="muted" style="margin:8px 0 0">${setup ? 'Choose a band name and a shared admin password. Anyone with the password can manage the inventory, so share it only with your volunteers.' : 'Enter the band password to continue.'}</p>
        </div>
        <form class="card stack" style="gap:14px" id="gate-form" autocomplete="on">
          ${setup ? `<div class="field"><label class="label" for="g-name">Band name</label><input class="input" id="g-name" maxlength="60" placeholder="e.g. Riverside Youth Band" required></div>` : ''}
          <div class="field"><label class="label" for="g-pw">${setup ? 'Choose a password (at least 6 characters)' : 'Password'}</label>
            <input class="input" id="g-pw" type="password" minlength="${setup ? 6 : 1}" required autocomplete="${setup ? 'new-password' : 'current-password'}"></div>
          ${setup ? `<div class="field"><label class="label" for="g-pw2">Repeat password</label><input class="input" id="g-pw2" type="password" required autocomplete="new-password"></div>` : ''}
          <div class="small" id="g-err" style="color:var(--red);min-height:18px" role="alert"></div>
          <button class="btn btn-primary" type="submit" id="g-go">${setup ? 'Create and continue' : 'Sign in'}</button>
        </form>
      </div></main>`;
    const form = app.querySelector('#gate-form');
    const err = app.querySelector('#g-err');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const pw = app.querySelector('#g-pw').value;
      if (setup && pw !== app.querySelector('#g-pw2').value) { err.textContent = 'The two passwords do not match.'; return; }
      const btn = app.querySelector('#g-go');
      btn.disabled = true;
      try {
        await S.signIn(pw, { setup, bandName: setup ? app.querySelector('#g-name').value : '' });
        resolve();
      } catch (ex) {
        err.textContent = ex.message || 'Something went wrong.';
        btn.disabled = false;
      }
    });
  });
}
