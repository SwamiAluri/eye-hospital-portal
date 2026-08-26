/* Builds the shared topbar (identity + prev/next) and the in-page section jump
   list for every screen mockup, from the data-screen attribute on <body>.
   Plain script so the files open over file:// without a server. */

(function () {
  var screens = window.IP_SCREENS || [];
  var id = document.body.getAttribute('data-screen');
  var i = screens.findIndex(function (s) { return s.id === id; });
  if (i < 0) return;

  var s = screens[i];
  var prev = screens[i - 1];
  var next = screens[i + 1];

  document.title = s.id + ' · ' + s.title + ' — IP target mockups';

  var statusClass = s.status === 'New' ? 'new' : s.status === 'Keep' ? 'keep' : '';

  var bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML =
    '<a href="index.html">&larr; All screens</a>' +
    '<span class="sid">' + s.id + '</span>' +
    '<span class="title">' + s.title + '</span>' +
    '<span class="meta"><code>' + s.route + '</code> &middot; ' + s.persona + ' &middot; ' + s.shell + '</span>' +
    '<span class="pill ' + statusClass + '">' + s.status + '</span>' +
    '<span class="spacer"></span>' +
    '<span class="meta">' + (s.covers ? s.covers.length + ' views' : '') + '</span>' +
    '<span class="meta">' + s.tasks + '</span>' +
    (prev ? '<a href="' + prev.file + '">&larr; ' + prev.id + '</a>' : '') +
    (next ? '<a href="' + next.file + '">' + next.id + ' &rarr;</a>' : '');

  document.body.insertBefore(bar, document.body.firstChild);

  /* Jump list: every top-level section in this file, so long screens with many
     steps or tabs stay navigable without scrolling past everything. */
  var main = document.querySelector('main');
  if (!main) return;

  var heads = main.querySelectorAll('h2.sec');
  if (heads.length < 3) return;

  var nav = document.createElement('nav');
  nav.className = 'jumps';
  nav.setAttribute('aria-label', 'Sections on this page');

  Array.prototype.forEach.call(heads, function (h, n) {
    if (!h.id) h.id = 'sec-' + (n + 1);
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    nav.appendChild(a);
  });

  main.insertBefore(nav, main.firstChild);
})();
