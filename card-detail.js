// Card Detail Page JavaScript
// localStorage და sessionStorage polyfill ძველი ბრაუზერებისთვის
if (!window.localStorage) {
    console.log('localStorage not supported, using memory storage');
    window.localStorage = {
        data: {},
        setItem: function(key, value) {
            this.data[key] = value;
        },
        getItem: function(key) {
            return this.data[key] || null;
        },
        removeItem: function(key) {
            delete this.data[key];
        },
        clear: function() {
            this.data = {};
        }
    };
}

// sessionStorage polyfill ძველი ბრაუზერებისთვის
if (!window.sessionStorage) {
    console.log('sessionStorage not supported, using memory storage');
    window.sessionStorage = {
        data: {},
        setItem: function(key, value) {
            this.data[key] = value;
        },
        getItem: function(key) {
            return this.data[key] || null;
        },
        removeItem: function(key) {
            delete this.data[key];
        },
        clear: function() {
            this.data = {};
        }
    };
}

// Card Detail Page Functions
// ქარდის ID URL-იდან
let cardId = null;

// ქარდის მონაცემების ჩატვირთვა
function loadCardDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    cardId = urlParams.get('id');
    
    console.log('Loading card details for ID:', cardId);
    
    if (!cardId) {
        console.log('Card ID not found');
        return;
    }
    
    try {
        // localStorage-იდან ქარდების ჩატვირთვა
        let savedCards = localStorage.getItem('adminCards');
        
        // თუ localStorage-ში არ არის, სცადოს sessionStorage-ში
        if (!savedCards) {
            console.log('No cards in localStorage, checking sessionStorage...');
            try {
                savedCards = sessionStorage.getItem('adminCards');
                if (savedCards) {
                    console.log('Found cards in sessionStorage');
                }
            } catch (sessionError) {
                console.warn('sessionStorage access failed:', sessionError);
            }
        }
        
        console.log('Raw saved cards from detail page:', savedCards);
        
        if (savedCards) {
            const cards = JSON.parse(savedCards);
            console.log('Parsed cards from detail page:', cards);
            
            const card = cards.find(c => c.id === cardId);
            console.log('Found card:', card);
            
            if (card) {
                displayCardDetails(card);
            } else {
                console.log('Card not found with ID:', cardId);
                showNoCard();
            }
        } else {
            console.log('No cards found in storage');
            showNoCard();
        }
    } catch (error) {
        console.error('Error loading card details:', error);
        showNoCard();
    }
}

// ქარდის დეტალების ჩვენება
function displayCardDetails(card) {
    const photoCarousel = document.getElementById('photoCarousel');
    const carouselDots = document.getElementById('carouselDots');
    const noPhotos = document.getElementById('noPhotos');
    
    if (card.photos && card.photos.length > 0) {
        // კარუსელის ჩვენება
        if (photoCarousel) photoCarousel.style.display = 'block';
        if (carouselDots) carouselDots.style.display = 'flex';
        if (noPhotos) noPhotos.style.display = 'none';
        
        // კარუსელის ინიციალიზაცია
        initPhotoCarousel(card.photos);
    } else {
        // ფოტოების გარეშე შეტყობინება
        if (photoCarousel) photoCarousel.style.display = 'none';
        if (carouselDots) carouselDots.style.display = 'none';
        if (noPhotos) noPhotos.style.display = 'block';
    }
}

// ქარდი არ მოიძებნა
function showNoCard() {
    const noPhotosEl = document.getElementById('noPhotos');
    
    if (noPhotosEl) noPhotosEl.style.display = 'block';
}


// კარუსელის ცვლადები
let currentSlide = 0;
let totalSlides = 0;
let photos = [];

// ფოტო კარუსელის ინიციალიზაცია
function initPhotoCarousel(photoArray) {
    photos = photoArray;
    totalSlides = photos.length;
    currentSlide = 0;
    
    const carouselContainer = document.querySelector('.carousel-container');
    const carouselDots = document.getElementById('carouselDots');
    const carouselCounter = document.getElementById('carouselCounter');
    
    if (!carouselContainer) return;
    
    // სლაიდების შექმნა
    carouselContainer.innerHTML = '';
    photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
        slide.innerHTML = `<img src="${photo.url}" alt="${photo.title || `ფოტო ${index + 1}`}">`;
        carouselContainer.appendChild(slide);
    });
    
    // ღილაკების შექმნა
    if (carouselDots) {
        carouselDots.innerHTML = '';
        photos.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => goToSlide(index));
            carouselDots.appendChild(dot);
        });
    }
    
    // მთვლელი
    updateCounter();
    
    // კონტროლების დამატება
    setupCarouselControls();
}

// კარუსელის კონტროლების დაყენება
function setupCarouselControls() {
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (prevBtn) prevBtn.onclick = () => changeSlide(-1);
    if (nextBtn) nextBtn.onclick = () => changeSlide(1);
    
    // კლავიატურის კონტროლი
    document.addEventListener('keydown', handleKeyboard);
}

// კლავიატურის კონტროლი
function handleKeyboard(e) {
    if (e.key === 'ArrowLeft') {
        changeSlide(-1);
    } else if (e.key === 'ArrowRight') {
        changeSlide(1);
    }
}

// სლაიდის შეცვლა
function changeSlide(direction) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    
    if (slides.length === 0) return;
    
    // მიმდინარე სლაიდის ფარული
    slides[currentSlide].classList.remove('active');
    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
    
    // ახალი ინდექსის გამოთვლა
    currentSlide += direction;
    
    if (currentSlide >= totalSlides) {
        currentSlide = 0;
    } else if (currentSlide < 0) {
        currentSlide = totalSlides - 1;
    }
    
    // ახალი სლაიდის ჩვენება
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
    
    updateCounter();
}

// კონკრეტულ სლაიდზე გადასვლა
function goToSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    
    if (slides.length === 0) return;
    
    // მიმდინარე სლაიდის ფარული
    slides[currentSlide].classList.remove('active');
    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
    
    // ახალი სლაიდის ჩვენება
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
    
    updateCounter();
}

// მთვლელის განახლება
function updateCounter() {
    const counter = document.getElementById('carouselCounter');
    if (counter) {
        counter.textContent = `${currentSlide + 1} / ${totalSlides}`;
    }
}

// გვერდის ჩატვირთვა
document.addEventListener('DOMContentLoaded', loadCardDetails);
