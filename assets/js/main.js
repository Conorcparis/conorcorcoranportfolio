// main.js

// Smooth scroll behavior
document.documentElement.style.scrollBehavior = 'smooth';

// Language toggle functionality
let currentLanguage = 'en';

function switchLanguage(lang) {
    currentLanguage = lang;
    document.body.className = lang === 'fr' ? 'french' : '';
    
    // Update navigation menu text
    document.querySelectorAll('[data-en][data-fr]').forEach(element => {
        if (lang === 'fr' && element.dataset.fr) {
            element.textContent = element.dataset.fr;
        } else if (element.dataset.en) {
            element.textContent = element.dataset.en;
        }
    });
    
    // Update language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`lang-${lang}`).classList.add('active');
    
    // Update typewriter words based on language
    updateTypewriterWords(lang);
    
    // Save language preference
    localStorage.setItem('preferred-language', lang);
}

function updateTypewriterWords(lang) {
    const enWords = ['AI Strategy Leader', 'Sales Executive', 'Tech Innovator', 'Growth Driver'];
    const frWords = ['Leader Stratégie IA', 'Directeur Commercial', 'Innovateur Tech', 'Moteur de Croissance'];
    
    const words = lang === 'fr' ? frWords : enWords;
    
    // Update the typewriter effect with new words
    if (window.typewriterInterval) {
        clearInterval(window.typewriterInterval);
    }
    
    const typewriterElement = document.querySelector('.typewriter');
    if (typewriterElement) {
        let wordIndex = 0;
        
        function typeWriter() {
            const currentWord = words[wordIndex];
            let charIndex = 0;
            
            function type() {
                if (charIndex < currentWord.length) {
                    typewriterElement.textContent += currentWord.charAt(charIndex);
                    charIndex++;
                    setTimeout(type, 100);
                } else {
                    setTimeout(() => {
                        typewriterElement.textContent = '';
                        wordIndex = (wordIndex + 1) % words.length;
                        typeWriter();
                    }, 2000);
                }
            }
            type();
        }
        
        typewriterElement.textContent = '';
        setTimeout(typeWriter, 1000);
    }
}

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('preferred-language') || 'en';
    switchLanguage(savedLanguage);
    
    // Language toggle event listeners
    document.getElementById('lang-en').addEventListener('click', () => switchLanguage('en'));
    document.getElementById('lang-fr').addEventListener('click', () => switchLanguage('fr'));
    
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const nav = document.querySelector('nav');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            // Toggle mobile menu (you can implement mobile menu dropdown here)
            console.log('Mobile menu clicked');
        });
    }

    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
            }
        });
    }, observerOptions);

    // Observe all sections
    document.querySelectorAll('section').forEach(section => {
        observer.observe(section);
    });

    // Start typewriter effect
    updateTypewriterWords(currentLanguage);

    // Skill tag hover effects
    document.querySelectorAll('.skill-tag').forEach(tag => {
        tag.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
        });
        
        tag.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });

    // Contact form enhancement
    const contactForm = document.querySelector('#contact form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Add form validation and submission logic
            const formData = new FormData(this);
            console.log('Form submitted:', Object.fromEntries(formData));
            
            // Show success message
            const successMsg = document.createElement('div');
            successMsg.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mt-4';
            
            const successText = currentLanguage === 'fr' 
                ? 'Merci ! Votre message a été envoyé.' 
                : 'Thank you! Your message has been sent.';
            
            successMsg.textContent = successText;
            this.appendChild(successMsg);
            
            setTimeout(() => successMsg.remove(), 5000);
            this.reset();
        });
    }
});

// CV Agent demo function
function openCVAgent() {
    // Check if CV agent exists in the cv-rag-agent folder
    const cvAgentPath = './cv-rag-agent/client/build/index.html';
    
    // Try to open in a new window/tab
    const newWindow = window.open(cvAgentPath, '_blank');
    
    if (!newWindow) {
        const alertText = currentLanguage === 'fr' 
            ? 'La démo de l\'Agent CV sera bientôt disponible ! Revenez plus tard.' 
            : 'CV Agent demo will be available soon! Check back later.';
        alert(alertText);
    }
}

// Scroll progress indicator
window.addEventListener('scroll', function() {
    const scrollProgress = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    
    let progressBar = document.querySelector('.scroll-progress');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--primary-green), var(--primary-blue));
            z-index: 1000;
            transition: width 0.3s ease;
        `;
        document.body.appendChild(progressBar);
    }
    
    progressBar.style.width = scrollProgress + '%';
});

// Add loading animation
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
});
