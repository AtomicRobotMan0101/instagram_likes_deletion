// Paste into Chrome DevTools Console on Instagram > Your activity > Likes.
// Starts immediately. Stop: instagramUnlike.stop()
(async () => {
  'use strict';
  if (location.hostname !== 'www.instagram.com' ||
      location.pathname !== '/your_activity/interactions/likes/') {
    throw new Error('Open the Instagram Likes activity page first.');
  }
  if (window.instagramUnlike?.running) throw new Error('Already running.');
  const state = window.instagramUnlike = {
    running: true, stopped: false, removed: 0,
    stop() { this.stopped = true; console.info('Stopping before the next action.'); }
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const guard = () => {
    if (state.stopped) throw new Error('Stopped by user.');
    if (location.pathname !== '/your_activity/interactions/likes/')
      throw new Error('Page changed.');
    if (/try again later|action blocked|we restrict certain activity/i.test(document.body.innerText))
      throw new Error('Instagram restriction detected.');
  };
  const wait = async (fn, timeout = 20000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      guard();
      const result = fn();
      if (result) return result;
      await sleep(250);
    }
    throw new Error('Timed out; stopped without retrying the batch.');
  };
  const visible = e => !!e && e.getClientRects().length > 0;
  const article = () => document.querySelector('article');
  const exact = (root, text) => Array.from(root.querySelectorAll('*'))
    .find(e => visible(e) && e.textContent.trim() === text &&
      !Array.from(e.children).some(c => c.textContent.trim() === text));
  const cards = () => Array.from(article()?.querySelectorAll('[role="button"][aria-label]') || [])
    .filter(e => /^(Video|Photo|Carousel).*\bby @/.test(e.getAttribute('aria-label')) &&
      getComputedStyle(e).pointerEvents !== 'none');
  const selected = () => Number(article()?.innerText.match(/\b(\d+) selected\b/)?.[1] || 0);
  const click = e => {
    guard();
    if (!e || !e.isConnected) throw new Error('Expected control missing.');
    e.click();
  };
  const clearSelection = async () => {
    for (let attempt = 0; selected() > 0 && attempt < 100; attempt++) {
      const before = selected();
      const checked = cards().find(card => {
        const toggle = card.querySelector('[aria-label="Toggle checkbox"]');
        return toggle && Array.from(toggle.querySelectorAll('*')).some(icon =>
          (icon.style.maskImage || getComputedStyle(icon).maskImage || '')
            .includes('circle-check__filled'));
      });
      if (!checked) throw new Error(`Cannot identify the ${before} existing checked posts.`);
      click(checked);
      await wait(() => selected() === before - 1);
    }
    if (selected()) throw new Error(`Selection could not be cleared: ${selected()} selected.`);
  };
  const loadMore = () => {
    const last = cards().at(-1);
    if (last) last.scrollIntoView({block: 'end'});
    else {
      let e = article();
      while (e && !(e.scrollHeight > e.clientHeight &&
        /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement;
      (e || document.scrollingElement).scrollTop += 800;
    }
  };
  try {
    if (document.querySelector('[role="dialog"]')) throw new Error('Close the existing dialog first.');
    while (true) {
      guard();
      if (!article()) throw new Error('Likes grid missing.');
      // Instagram enables the clickable post wrappers only in selection mode.
      const select = exact(article(), 'Select');
      if (select) {
        click(select);
        await wait(() => exact(article(), 'Cancel'));
      }
      if (!exact(article(), 'Cancel')) throw new Error('Selection mode not available.');
      // Clear checked cards directly; Cancel/Select can retain stale selection.
      await clearSelection();
      // Wait for lazy loading. A smaller batch is allowed only after loading settles.
      for (let attempt = 0; cards().length < 20 && attempt < 10; attempt++) {
        loadMore();
        await sleep(1000);
        guard();
      }
      if (!cards().length) {
        if (document.querySelector('article [role="progressbar"]'))
          throw new Error('Loading has not finished; rerun when it settles.');
        console.info('No remaining loaded likes. Verify the page is empty.');
        break;
      }
      if (cards().length < 20 && document.querySelector('article [role="progressbar"]'))
        throw new Error('Loading has not finished; no partial batch submitted.');
      const batch = cards().slice(0, 20);
      const labels = batch.map(e => e.getAttribute('aria-label'));
      for (let i = 0; i < labels.length; i++) {
        const card = cards().find(e => e.getAttribute('aria-label') === labels[i]);
        if (!card?.querySelector('[aria-label="Toggle checkbox"]'))
          throw new Error('Selection layout changed.');
        click(card);
        await wait(() => selected() === i + 1);
      }
      click(await wait(() => exact(article(), 'Unlike')));
      const dialog = await wait(() => Array.from(document.querySelectorAll('[role="dialog"]'))
        .find(e => visible(e) && /Unlike (this post|these posts)\?/i.test(e.innerText)));
      if (selected() !== batch.length || batch.length > 20)
        throw new Error('Selection count changed; confirmation not submitted.');
      const confirm = Array.from(dialog.querySelectorAll('button,[role="button"]'))
        .find(e => e.textContent.trim() === 'Unlike');
      click(confirm);
      await wait(() => !document.querySelector('[role="dialog"]'));
      // Verify disappearance even if Instagram exits selection mode automatically.
      await wait(() => labels.every(label => !Array.from(
        article()?.querySelectorAll('[aria-label]') || []
      ).some(e => e.getAttribute('aria-label') === label)));
      state.removed += batch.length;
      console.info(`Removed ${batch.length}; total ${state.removed}. Waiting 60 seconds.`);
      // Every new batch starts at least 60 seconds after the previous success.
      const resume = Date.now() + 60000;
      while (Date.now() < resume) {
        guard();
        await sleep(Math.min(500, resume - Date.now()));
      }
    }
  } catch (error) {
    console.warn('Instagram unlike tool stopped:', error.message,
      'Verified removals:', state.removed,
      'Inspect the page before restarting.');
  } finally {
    state.running = false;
  }
})();
