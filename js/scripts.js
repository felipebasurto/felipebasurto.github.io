/**
 * Felipe Basurto Portfolio - iOS 26.1 Liquid Glass Style
 * Interactive JavaScript Effects
 * Version: 3.0.0
 */

(function() {
  'use strict';

  // ============================================
  // INTERSECTION OBSERVER FOR SCROLL ANIMATIONS
  // ============================================
  
  const initScrollAnimations = () => {
    const fadeElements = document.querySelectorAll('.fade-in');
    
    if (!fadeElements.length) return;
    
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.1
    };
    
    const observerCallback = (entries, observer) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Staggered animation delay
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, index * 100);
          
          observer.unobserve(entry.target);
        }
      });
    };
    
    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    fadeElements.forEach(element => {
      observer.observe(element);
    });
  };

  // ============================================
  // NAVBAR SCROLL EFFECTS
  // ============================================
  
  const initNavbarEffects = () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    let lastScrollY = window.scrollY;
    let ticking = false;
    
    const updateNavbar = () => {
      const currentScrollY = window.scrollY;
      
      // Add/remove scrolled class for styling
      if (currentScrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.12)';
        navbar.style.boxShadow = '0 8px 40px rgba(0, 0, 0, 0.2)';
      } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.08)';
        navbar.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15)';
      }
      
      lastScrollY = currentScrollY;
      ticking = false;
    };
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateNavbar);
        ticking = true;
      }
    }, { passive: true });
  };

  // ============================================
  // SMOOTH SCROLL FOR ANCHOR LINKS
  // ============================================
  
  const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
          const navbarHeight = 100;
          const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - navbarHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  };

  // ============================================
  // ACTIVE NAV LINK HIGHLIGHTING
  // ============================================
  
  const initActiveNavHighlight = () => {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.navbar__link');
    
    if (!sections.length || !navLinks.length) return;
    
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -80% 0px',
      threshold: 0
    };
    
    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const activeId = entry.target.getAttribute('id');
          
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${activeId}`) {
              link.classList.add('active');
            }
          });
        }
      });
    };
    
    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    sections.forEach(section => {
      observer.observe(section);
    });
  };

  // ============================================
  // PARALLAX EFFECT FOR BACKGROUND ORBS
  // ============================================
  
  const initParallaxEffect = () => {
    const orb = document.querySelector('.background-orb');
    if (!orb) return;
    
    let ticking = false;
    
    const updateParallax = () => {
      const scrollY = window.scrollY;
      const translateY = scrollY * 0.3;
      
      orb.style.transform = `translate(-50%, calc(-50% + ${translateY}px))`;
      ticking = false;
    };
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  };

  // ============================================
  // MOUSE GLOW EFFECT ON CARDS
  // ============================================
  
  const initCardGlowEffect = () => {
    const cards = document.querySelectorAll('.project-card, .timeline-item__content, .contact__card');
    
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  };

  // ============================================
  // TYPING EFFECT FOR HERO SUBTITLE (Optional)
  // ============================================
  
  const initTypingEffect = () => {
    const subtitle = document.querySelector('.hero__subtitle');
    if (!subtitle) return;
    
    const text = subtitle.textContent;
    subtitle.textContent = '';
    subtitle.style.visibility = 'visible';
    
    let i = 0;
    const typeWriter = () => {
      if (i < text.length) {
        subtitle.textContent += text.charAt(i);
        i++;
        setTimeout(typeWriter, 50);
      }
    };
    
    // Start after a short delay
    setTimeout(typeWriter, 500);
  };

  // ============================================
  // PRELOADER
  // ============================================
  
  const initPreloader = () => {
    document.body.classList.add('loaded');
  };

  // ============================================
  // KEYBOARD NAVIGATION ENHANCEMENTS
  // ============================================
  
  const initKeyboardNav = () => {
    // Add keyboard support for project cards
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  };

  // ============================================
  // PERFORMANCE: THROTTLE FUNCTION
  // ============================================
  
  const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  // ============================================
  // INITIALIZATION
  // ============================================
  
  const init = () => {
    // Wait for DOM to be ready
    initScrollAnimations();
    initNavbarEffects();
    initSmoothScroll();
    initActiveNavHighlight();
    initParallaxEffect();
    initCardGlowEffect();
    initKeyboardNav();
    initPreloader();
  };

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Ensure animations trigger on page load
  window.addEventListener('load', () => {
    // Trigger initial fade-ins for elements in viewport
    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        el.classList.add('visible');
      }
    });
  });

})();
