/* Vibery Blocks motion: reveal on scroll. No deps. Adds .vb-in once; honours reduced motion + no-IO browsers. */
(function () {
	window.__vbm = 1;
	var els = [].slice.call(document.querySelectorAll('.vb-m.vb-r-fade,.vb-m.vb-r-up,.vb-m.vb-r-down,.vb-m.vb-r-left,.vb-m.vb-r-right,.vb-m.vb-r-zoom,.vb-m.vb-stagger'));
	var done = function (e) {
		e.classList.add('vb-in');
		// after the reveal, drop the stagger delay so a hover effect on the same block is instant
		var kids = e.classList.contains('vb-stagger') ? e.children : null;
		if (kids) { for (var i = 12; i < kids.length; i++) kids[i].style.setProperty('--vb-i', i); }
		e.addEventListener('transitionend', function f(t) { if (kids ? t.target === kids[kids.length - 1] : t.target === e) { e.classList.add('vb-done'); e.removeEventListener('transitionend', f); } });
	};
	if (!els.length) return;
	if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(done); return; }
	var io = new IntersectionObserver(function (es) {
		es.forEach(function (x) { if (x.isIntersecting) { done(x.target); io.unobserve(x.target); } });
	}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
	// next frame: the hidden state is already painted, so above-the-fold blocks animate in instead of flashing
	requestAnimationFrame(function () { els.forEach(function (e) { io.observe(e); }); });
})();
