(function(){
  const year = document.getElementById('year');
  if(year) year.textContent = String(new Date().getFullYear());

  // Mobile nav toggle
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.getElementById('navMenu');
  if(toggle && menu){
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // close on click
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded','false');
    }));
  }

  // Reveal on scroll
  const items = Array.from(document.querySelectorAll('.reveal'));
  if(items.length){
    const io = new IntersectionObserver((entries) => {
      for(const e of entries){
        if(e.isIntersecting){
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.12 });
    items.forEach(el => io.observe(el));
  }

  // Subtle parallax grid
  const grid = document.querySelector('.bg__grid');
  if(grid){
    window.addEventListener('mousemove', (ev) => {
      const x = (ev.clientX / window.innerWidth - 0.5) * 12;
      const y = (ev.clientY / window.innerHeight - 0.5) * 8;
      grid.style.transform = `perspective(900px) rotateX(64deg) translateY(-120px) translateX(${x}px) translateZ(${y}px)`;
    }, { passive:true });
  }
})();
