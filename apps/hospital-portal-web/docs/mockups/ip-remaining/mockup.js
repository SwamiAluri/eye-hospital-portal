(function () {
  var screens = window.REMAINING_SCREENS || [];
  var id = document.body.getAttribute('data-screen');
  var i = screens.findIndex(function (s) { return s.id === id; });
  if (i < 0) return;

  var s = screens[i];
  var prev = screens[i - 1];
  var next = screens[i + 1];
  var n = i + 1;
  var total = screens.length;
  document.title = s.id + ' · ' + s.title + ' — remaining-work mockups';

  var statusClass = s.status === 'Fix' ? 'new' : 'new';

  var bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML =
    '<a href="workflow.html">How it opens</a>' +
    '<span class="sid">' + s.id + '</span>' +
    '<span class="title">' + s.title + '</span>' +
    '<span class="meta">' + s.sidebar + '</span>' +
    '<span class="pill ' + statusClass + '">' + n + ' of ' + total + '</span>' +
    '<span class="spacer"></span>' +
    (prev ? '<a href="' + prev.file + '">&larr; ' + prev.id + ' ' + prev.short + '</a>' : '<span class="meta">First</span>') +
    (next ? '<a href="' + next.file + '">' + next.id + ' ' + next.short + ' &rarr;</a>' : '<span class="meta">Last</span>');
  document.body.insertBefore(bar, document.body.firstChild);

  var main = document.querySelector('main');
  if (!main) return;

  var flow = document.createElement('nav');
  flow.className = 'flow';
  flow.setAttribute('aria-label', 'Mockup sequence');
  screens.forEach(function (x, n0) {
    if (n0) {
      var arr = document.createElement('span');
      arr.className = 'arr';
      arr.textContent = '→';
      flow.appendChild(arr);
    }
    var a = document.createElement('a');
    a.href = x.file;
    a.innerHTML = '<b>' + x.id + '</b> ' + x.short;
    if (x.id === id) a.className = 'here';
    a.title = x.click;
    flow.appendChild(a);
  });
  main.insertBefore(flow, main.firstChild);

  var fold = document.createElement('details');
  fold.className = 'open-path-fold';
  fold.innerHTML =
    '<summary>How this opens in the app · ' + s.hostScreen + '</summary>' +
    '<section class="open-path">' +
      '<div class="host-frame">' +
        '<div class="hf-side">' + s.sidebar + '</div>' +
        '<div class="hf-main">' +
          '<div class="hf-title">' + s.hostScreen + '</div>' +
          '<div class="hf-route"><code>' + s.hostRoute + '</code></div>' +
          '<div class="hf-click"><span class="btn sm primary">' + s.click + '</span></div>' +
          '<p class="hf-result"><b>Opens:</b> ' + s.opens + '</p>' +
          '<p class="hf-result"><b>This UI appears as:</b> ' + s.appearsWhere + '</p>' +
          '<p class="hf-next"><b>Next click after this work:</b> ' + s.nextClick + '</p>' +
        '</div>' +
      '</div>' +
    '</section>';

  function peer(x, kind) {
    if (!x) {
      return '<div class="pn-card ghost"><div class="pn-k">' +
        (kind === 'prev' ? 'No earlier mockup' : 'No later mockup') +
        '</div><div class="pn-d">' +
        (kind === 'prev'
          ? 'Upstream: OPD exam queues the patient onto the Counsellor Waiting List.'
          : 'Chair released. Follow-up is on Appointments.') +
        '</div></div>';
    }
    return '<a class="pn-card" href="' + x.file + '">' +
      '<div class="pn-k">' + (kind === 'prev' ? 'Previous' : 'Next') + ' · ' + x.id + '</div>' +
      '<div class="pn-t">' + x.short + '</div>' +
      '<div class="pn-d"><b>Click:</b> ' + x.click + '</div>' +
      '</a>';
  }
  var pn = document.createElement('nav');
  pn.className = 'pn';
  pn.setAttribute('aria-label', 'Previous and next mockup');
  pn.innerHTML = peer(prev, 'prev') +
    '<div class="pn-card now">' +
      '<div class="pn-k">You are here · ' + s.id + ' · ' + n + ' of ' + total + '</div>' +
      '<div class="pn-t">' + s.short + '</div>' +
      '<div class="pn-d"><b>Click:</b> ' + s.click + '</div>' +
    '</div>' +
    peer(next, 'next');
  fold.appendChild(pn);
  main.insertBefore(fold, flow.nextSibling);

  var heads = main.querySelectorAll('h2.sec');
  if (heads.length >= 2) {
    var nav = document.createElement('nav');
    nav.className = 'jumps';
    nav.setAttribute('aria-label', 'Sections on this page');
    Array.prototype.forEach.call(heads, function (h, n2) {
      if (!h.id) h.id = 'sec-' + (n2 + 1);
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.trim();
      nav.appendChild(a);
    });
    main.insertBefore(nav, fold.nextSibling);
  }

  var foot = document.createElement('nav');
  foot.className = 'walk-foot';
  foot.setAttribute('aria-label', 'Previous or next mockup');
  foot.innerHTML =
    (prev
      ? '<a class="wf-btn" href="' + prev.file + '"><span class="tiny">Previous mockup</span><b>' + prev.id + ' · ' + prev.short + '</b><span class="tiny">Opens from ' + prev.hostScreen + '</span></a>'
      : '<a class="wf-btn ghost" href="workflow.html"><span class="tiny">How it opens</span><b>Click-path list</b></a>') +
    '<div class="wf-mid"><a href="workflow.html">Step ' + n + ' of ' + total + ' · click paths</a></div>' +
    (next
      ? '<a class="wf-btn primary" href="' + next.file + '"><span class="tiny">Next mockup</span><b>' + next.id + ' · ' + next.short + '</b><span class="tiny">Click: ' + next.click + '</span></a>'
      : '<a class="wf-btn primary" href="workflow.html"><span class="tiny">Done</span><b>Back to click paths</b></a>');
  document.body.appendChild(foot);
})();
