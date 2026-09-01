// ===== ARCHUB - მთავარი JavaScript ფაილი =====
// ეს ფაილი შეიცავს მთავარი გვერდის ფუნქციონალს
// ავტორიზაცია, პროექტების ჩატვირთვა, კონტაქტ ფორმა

// API-დან მოსული სურათები მხოლოდ აპლიკაციის upload საქაღალდეებიდან ჩაიტვირთოს.
function getSafeUploadedImageUrl(value) {
    if (typeof value !== 'string') return null;

    const rawValue = value.trim().replace(/\\/g, '/');
    if (!rawValue || rawValue.startsWith('//')) return null;

    try {
        const decodedRawPath = decodeURIComponent(rawValue).split(/[?#]/, 1)[0];
        if (decodedRawPath.split('/').includes('..')) return null;

        const candidate = new URL(rawValue, window.location.origin);
        if (candidate.origin !== window.location.origin || candidate.username || candidate.password) {
            return null;
        }

        const pathname = decodeURIComponent(candidate.pathname);
        const allowedUpload = /^\/static\/uploads\/(?:main|gallery|carousel)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|gif|webp)$/i;
        return allowedUpload.test(pathname) ? pathname : null;
    } catch (error) {
        return null;
    }
}

window.getSafeUploadedImageUrl = getSafeUploadedImageUrl;

function createUploadedImage(value, altText, className = '', loading = 'lazy') {
    const safeUrl = getSafeUploadedImageUrl(value);
    if (!safeUrl) return null;

    const image = document.createElement('img');
    image.src = safeUrl;
    image.alt = String(altText || '');
    image.loading = loading;
    if (className) image.className = className;
    image.addEventListener('error', () => {
        if (image.parentNode) {
            image.replaceWith(createImagePlaceholder('ფოტო ვერ ჩაიტვირთა'));
        }
    }, { once: true });
    return image;
}

function createImagePlaceholder(message = 'ფოტო არ არის') {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.textContent = message;
    placeholder.style.cssText = 'width: 100%; min-height: 160px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #777;';
    return placeholder;
}

function replaceWithMessage(container, message) {
    const messageElement = document.createElement('div');
    messageElement.style.cssText = 'width: 100%; text-align: center; color: #666; padding: 40px;';
    messageElement.textContent = String(message || '');
    container.replaceChildren(messageElement);
    return messageElement;
}

function createLikeButton(className, projectId, isLiked, iconSize = 20) {
    const numericProjectId = Number(projectId);
    if (!Number.isSafeInteger(numericProjectId) || numericProjectId < 1) return null;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.classList.toggle('liked', Boolean(isLiked));
    button.dataset.projectId = String(numericProjectId);

    const svgNamespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('width', String(iconSize));
    svg.setAttribute('height', String(iconSize));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', isLiked ? '#ffffff' : 'none');
    svg.setAttribute('stroke', '#ffffff');
    svg.setAttribute('stroke-width', '2');

    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3');
    svg.appendChild(path);
    button.appendChild(svg);
    return button;
}

// ===== Toast Notification სისტემა =====
const Toast = {
    container: null,
    
    init() {
        if (this.container) return;
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },
    
    show(message, type = 'info', duration = 4000) {
        this.init();
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        const safeType = Object.prototype.hasOwnProperty.call(icons, type) ? type : 'info';
        
        const toast = document.createElement('div');
        toast.className = `toast ${safeType}`;

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.textContent = icons[safeType];

        const messageElement = document.createElement('span');
        messageElement.className = 'toast-message';
        messageElement.textContent = String(message ?? '');

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'toast-close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => toast.remove());

        toast.append(icon, messageElement, closeButton);
        
        this.container.appendChild(toast);
        
        // ავტომატური წაშლა
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        return toast;
    },
    
    success(message, duration) { return this.show(message, 'success', duration); },
    error(message, duration) { return this.show(message, 'error', duration); },
    warning(message, duration) { return this.show(message, 'warning', duration); },
    info(message, duration) { return this.show(message, 'info', duration); }
};

// გლობალურად ხელმისაწვდომი
window.Toast = Toast;

document.addEventListener('DOMContentLoaded', function() {
    // ===== CSRF Token-ის წამოღება =====
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    // ===== უსაფრთხო fetch ფუნქცია =====
    const secureFetch = async (url, options = {}) => {
        // ჰედერების დამატება
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            ...options.headers,
        };
        
        // მოთხოვნის გაგზავნა
        return fetch(url, { ...options, headers });
    };
    
    // ===== კარუსელის ფოტოების ჩატვირთვა =====
    loadCarouselImages();
    
    // ===== ელემენტების არჩევა =====
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const authBtn = document.getElementById('authBtn');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');
    const myPageBtn = document.getElementById('myPageBtn');
    const mobileMyPageBtn = document.getElementById('mobileMyPageBtn');
    const showRegisterModalLink = document.getElementById('showRegisterModal');
    const showLoginModalLink = document.getElementById('showLoginModal');
    const showForgotPasswordLink = document.getElementById('showForgotPasswordModal');
    const backToLoginFromForgotLink = document.getElementById('backToLoginFromForgot');
    
    // ===== გლობალური ცვლადები =====
    // ავტორიზაციის სტატუსის თვალყურის დევნება
    let userAuthenticated = false;
    let currentUser = null;
    
    // --- ავტორიზაციის სტატუსის შემოწმება ---
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            userAuthenticated = data.logged_in;
            currentUser = data.logged_in ? data.user : null;
            updateAuthButtons(data.logged_in ? 'logout' : 'login');
            window.userAuthenticated = userAuthenticated;
            
            // სექცია 2 და 3-ის განახლება
            if (typeof loadCardsFromAPI === 'function') {
                try {
                    await loadCardsFromAPI();
                    renderProjectsCards();
                } catch (e) { /* ignore */ }
            }
            if (typeof initSection3Projects === 'function') {
                initSection3Projects().catch(() => {});
            }
        } catch (error) {
            userAuthenticated = false;
            currentUser = null;
            updateAuthButtons('login');
            window.userAuthenticated = false;
        }
    }
    
    // --- ავტორიზაციის ღილაკების განახლება ---
    function updateAuthButtons(state) {
        const userStatus = document.getElementById('userStatus');
        const mobileUserStatus = document.getElementById('mobileUserStatus');
        
        if (state === 'logout') {
            if (authBtn) {
                authBtn.textContent = 'გასვლა';
                authBtn.onclick = handleLogout;
            }
            if (mobileAuthBtn) {
                mobileAuthBtn.textContent = 'გასვლა';
                mobileAuthBtn.onclick = handleLogout;
            }
            // ჩემი გვერდის ღილაკების ჩვენება შესვლისას
            if (myPageBtn) {
                myPageBtn.classList.remove('hidden');
                myPageBtn.onclick = () => window.location.href = '/my-page';
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.classList.remove('hidden');
                mobileMyPageBtn.onclick = () => window.location.href = '/my-page';
            }
            // მომხმარებლის სახელის ჩვენება
            if (userStatus && currentUser) {
                userStatus.textContent = currentUser.username;
            }
            if (mobileUserStatus && currentUser) {
                mobileUserStatus.textContent = currentUser.username;
            }
        } else {
            if (authBtn) {
                authBtn.textContent = 'შესვლა';
                authBtn.onclick = () => openModal('loginModal');
            }
            if (mobileAuthBtn) {
                mobileAuthBtn.textContent = 'შესვლა';
                mobileAuthBtn.onclick = () => openModal('loginModal');
            }
            // ჩემი გვერდის ღილაკების დამალვა გამოსვლისას
            if (myPageBtn) {
                myPageBtn.classList.add('hidden');
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.classList.add('hidden');
            }
            // "გაიარეთ ავტორიზაცია" ტექსტის ჩვენება
            if (userStatus) {
                userStatus.textContent = 'გაიარეთ ავტორიზაცია';
            }
            if (mobileUserStatus) {
                mobileUserStatus.textContent = 'გაიარეთ ავტორიზაცია';
            }
        }
    }
    
    // --- გასვლის დამუშავება ---
    async function handleLogout() {
        // გაფრთხილება გასვლის წინ
        if (!confirm('ნამდვილად გსურთ სისტემიდან გასვლა?')) {
            return;
        }
        
        try {
            const response = await secureFetch('/api/logout', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                userAuthenticated = false;
                currentUser = null;
                window.userAuthenticated = false;
                updateAuthButtons('login');
                await loadCardsFromAPI();
                renderProjectsCards();
                if (typeof initSection3Projects === 'function') {
                    initSection3Projects().catch(() => {});
                }
                Toast.success('წარმატებით გამოხვედით სისტემიდან!');
                setTimeout(() => window.location.href = '/', 1500);
            } else {
                Toast.error('შეცდომა გასვლისას: ' + (data.error || 'უცნობი შეცდომა'));
            }
        } catch (error) {
            Toast.error('შეცდომა სერვერთან კავშირისას.');
        }
    }
    
    // --- მოდალური ფანჯრების მართვა ---
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // ყველა დახურვის ღილაკზე მოსმენის დამატება
    document.querySelectorAll('.auth-modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.auth-modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // --- ავტორიზაციის ღილაკების მოვლენები ---
    // ეს განისაზღვრება updateAuthButtons ფუნქციით ავტორიზაციის სტატუსის მიხედვით

    // --- მოდალური ფანჯრების გადართვა ---
    if (showRegisterModalLink) {
        showRegisterModalLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('loginModal');
            openModal('registerModal');
        });
    }

    if (showLoginModalLink) {
        showLoginModalLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('registerModal');
            openModal('loginModal');
        });
    }
    
    // --- შესვლის ფორმის გაგზავნა ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'შესვლა...';

            try {
                const response = await secureFetch('/api/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();

                if (result.success) {
                    userAuthenticated = true;
                    currentUser = result.user;
                    window.userAuthenticated = true;
                    updateAuthButtons('logout');
                    await loadCardsFromAPI();
                    renderProjectsCards();
                    if (typeof initSection3Projects === 'function') {
                        initSection3Projects().catch(() => {});
                    }
                    // ადმინის ლინკის ჩვენება თუ ადმინია
                    if (result.user && result.user.is_admin) {
                        const adminLinkContainer = document.getElementById('adminLinkContainer');
                        if (adminLinkContainer) {
                            adminLinkContainer.classList.remove('hidden');
                        }
                    }
                    Toast.success('წარმატებით შეხვედით სისტემაში!');
                    closeModal('loginModal');
                } else {
                    Toast.error('შეცდომა: ' + result.error);
                }
            } catch (error) {
                Toast.error('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'შესვლა';
            }
        });
    }

    // --- რეგისტრაციის ფორმის გაგზავნა ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const first_name = document.getElementById('registerFirstName').value;
            const last_name = document.getElementById('registerLastName').value;
            const email = document.getElementById('registerEmail').value;
            const phone = document.getElementById('registerPhone').value;
            const password = document.getElementById('registerPassword').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'რეგისტრაცია...';

            try {
                const response = await secureFetch('/api/register', {
                    method: 'POST',
                    body: JSON.stringify({ first_name, last_name, email, phone, password })
                });
                const result = await response.json();

                if (result.success) {
                    Toast.success(result.message);
                    closeModal('registerModal');
                    openModal('loginModal');
                } else {
                    Toast.error('შეცდომა: ' + result.error);
                }
            } catch (error) {
                Toast.error('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'რეგისტრაცია';
            }
        });
    }

    // --- პაროლის აღდგენის მოდალის გახსნა ---
    if (showForgotPasswordLink) {
        showForgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('loginModal');
            openModal('forgotPasswordModal');
        });
    }

    // --- უკან შესვლაზე დაბრუნება ---
    if (backToLoginFromForgotLink) {
        backToLoginFromForgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('forgotPasswordModal');
            openModal('loginModal');
        });
    }

    // --- პაროლის აღდგენის მოთხოვნის ფორმა ---
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value;
            const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'იგზავნება...';

            try {
                const response = await secureFetch('/api/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });
                const result = await response.json();

                if (result.success) {
                    Toast.success(result.message);
                    closeModal('forgotPasswordModal');
                    document.getElementById('forgotEmail').value = '';
                } else {
                    Toast.error('შეცდომა: ' + result.error);
                }
            } catch (error) {
                Toast.error('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'გაგზავნა';
            }
        });
    }

    // --- პაროლის შეცვლის ფორმა (reset token-ით) ---
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = document.getElementById('resetToken').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const submitBtn = resetPasswordForm.querySelector('button[type="submit"]');

            if (newPassword !== confirmPassword) {
                Toast.error('პაროლები არ ემთხვევა');
                return;
            }

            if (newPassword.length < 8 || newPassword.length > 128) {
                Toast.error('პაროლი უნდა შეიცავდეს 8-დან 128-მდე სიმბოლოს');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'შეცვლა...';

            try {
                const response = await secureFetch('/api/reset-password', {
                    method: 'POST',
                    body: JSON.stringify({ token, password: newPassword })
                });
                const result = await response.json();

                if (result.success) {
                    Toast.success('პაროლი წარმატებით შეიცვალა!');
                    closeModal('resetPasswordModal');
                    // URL-დან token პარამეტრის წაშლა
                    window.history.replaceState({}, document.title, window.location.pathname);
                    openModal('loginModal');
                } else {
                    Toast.error('შეცდომა: ' + result.error);
                }
            } catch (error) {
                Toast.error('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'შეცვლა';
            }
        });
    }

    // --- Reset token-ის შემოწმება URL-დან ---
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    const resetError = document.body.dataset.resetError || '';
    if (resetError) {
        Toast.error(resetError);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (resetToken) {
        document.getElementById('resetToken').value = resetToken;
        openModal('resetPasswordModal');
    }

    // --- მობილური მენიუ ---
    const burger = document.querySelector('.burger-menu');
    const panel = document.getElementById('mobileNavPanel');
    const icon = document.querySelector('.burger-icon');
    const body = document.body;

    function toggleMobileMenu() {
        panel.classList.toggle('active');
        icon.classList.toggle('active');
        body.classList.toggle('nav-open');
    }

    function closeMobileMenu() {
        panel.classList.remove('active');
        icon.classList.remove('active');
        body.classList.remove('nav-open');
    }

    if (burger) {
        burger.addEventListener('click', toggleMobileMenu);
    }
    
    document.querySelectorAll('.mobile-nav-link, .mobile-auth-btn, #mobileNavClose').forEach(btn => {
        btn.addEventListener('click', closeMobileMenu);
    });

    // --- პროექტების ღილაკები (gipc.ge, gipc.ogr.ge) ---
    // ღილაკები არის <a> ტეგები href-ით, დამატებითი JS არ სჭირდება

    // Close mobile menu on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) closeMobileMenu();
    });


    // --- პროექტების კარუსელი ---
let projectsCards = [];
let currentCardIndex = 0;
let projectsIsTransitioning = false;
let cardsContainer = null;
let totalCards = 0;

// Lazy loading observer სურათებისთვის
const lazyImageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const element = entry.target;
            const bgImage = getSafeUploadedImageUrl(element.dataset.bgImage);
            if (bgImage) {
                element.style.backgroundImage = `url("${bgImage}")`;
            }
            element.removeAttribute('data-bg-image');
            lazyImageObserver.unobserve(element);
        }
    });
}, {
    rootMargin: '100px', // იწყებს ჩატვირთვას 100px-ით ადრე
    threshold: 0.01
});

window.initProjectsCarousel = async function initProjectsCarousel() {
    // Use the existing Section 2 container directly
    cardsContainer = document.getElementById('cardsWrapper');
    if (!cardsContainer) return;

    await loadCardsFromAPI();
    renderProjectsCards();
    
    // Initialize Section 2 arrows
    initSection2Arrows();
}

// ===== სექცია 3 - პროექტების გრიდი =====
window.initSection3Projects = async function initSection3Projects() {
    const projectsGrid = document.getElementById('projectsGrid');
    if (!projectsGrid) return;
    
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success && data.projects) {
            projectsGrid.replaceChildren();
            data.projects.forEach(project => {
                projectsGrid.appendChild(createSection3CardElement(project));
            });
        } else {
            replaceWithMessage(projectsGrid, 'პროექტები ვერ ჩაიტვირთა');
        }
    } catch (error) {
        replaceWithMessage(projectsGrid, 'შეცდომა პროექტების ჩატვირთვისას');
    }
}

// Create card element for section 3
function createSection3CardElement(project) {
    const cardElement = document.createElement('div');
    cardElement.className = 'project-card';
    cardElement.setAttribute('data-project-id', project.id);

    const image = createUploadedImage(project.main_image_url, project.area, 'card-image');
    cardElement.appendChild(image || createImagePlaceholder());

    const cardInfo = document.createElement('div');
    cardInfo.className = 'card-info';
    const cardArea = document.createElement('div');
    cardArea.className = 'card-area';
    cardArea.textContent = String(project.area || '');
    cardInfo.appendChild(cardArea);
    cardElement.appendChild(cardInfo);

    if (window.userAuthenticated) {
        const likeButton = createLikeButton('like-btn', project.id, project.is_liked);
        if (likeButton) cardElement.appendChild(likeButton);
    }
    
    // Add click event to open gallery
    cardElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // ფოტოების მასივის აწყობა - მთავარი ფოტო ყოველთვის პირველი
        let allPhotos = [];
        const mainUrl = getSafeUploadedImageUrl(project.main_image_url);
        const projectPhotos = Array.isArray(project.photos)
            ? project.photos.map(getSafeUploadedImageUrl).filter(Boolean)
            : [];
        
        if (projectPhotos.length > 0) {
            if (mainUrl && projectPhotos.includes(mainUrl)) {
                allPhotos.push({ url: mainUrl, title: 'მთავარი ფოტო' });
                projectPhotos.forEach(url => {
                    if (url !== mainUrl) {
                        allPhotos.push({ url, title: 'პროექტის ფოტო' });
                    }
                });
            } else {
                allPhotos = projectPhotos.map(url => ({ url, title: 'პროექტის ფოტო' }));
            }
        } else if (mainUrl) {
            allPhotos.push({ url: mainUrl, title: 'მთავარი ფოტო' });
        }
        
        // Create project object with photos array
        const projectWithPhotos = {
            id: project.id,
            area: project.area,
            main_image_url: mainUrl,
            photos: allPhotos,
            is_liked: project.is_liked,
            likes_count: project.likes_count
        };
        
        // Open gallery modal (same as section 2)
        openGalleryForCard(projectWithPhotos);
    });
    
    // Add like button click event listener
    const likeBtn = cardElement.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLikeClick(project.id, likeBtn);
        });
    }
    
    return cardElement;
}

    // ქარდების ჩატვირთვა API-დან
async function loadCardsFromAPI() {
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success && data.projects) {
            projectsCards = data.projects.map(project => {
                // ფოტოების მასივის აწყობა - მთავარი ფოტო ყოველთვის პირველი
                let allPhotos = [];
                const mainUrl = getSafeUploadedImageUrl(project.main_image_url);
                const projectPhotos = Array.isArray(project.photos)
                    ? project.photos.map(getSafeUploadedImageUrl).filter(Boolean)
                    : [];
                
                if (projectPhotos.length > 0) {
                    // ჯერ მთავარი ფოტო (თუ არის და photos-ში შედის)
                    if (mainUrl && projectPhotos.includes(mainUrl)) {
                        allPhotos.push({ url: mainUrl, title: 'მთავარი ფოტო' });
                        // დანარჩენი ფოტოები (მთავარის გარდა)
                        projectPhotos.forEach(url => {
                            if (url !== mainUrl) {
                                allPhotos.push({ url, title: 'პროექტის ფოტო' });
                            }
                        });
                    } else {
                        // თუ main_image_url არ არის photos-ში, უბრალოდ photos
                        allPhotos = projectPhotos.map(url => ({ url, title: 'პროექტის ფოტო' }));
                    }
                } else if (mainUrl) {
                    allPhotos.push({ url: mainUrl, title: 'მთავარი ფოტო' });
                }
                
                return {
                    id: project.id,
                    title: project.title || '',
                    description: project.description || '',
                    area: project.area,
                    image: mainUrl,
                    link: `card-detail.html?id=${project.id}`,
                    is_liked: project.is_liked,
                    likes_count: project.likes_count,
                    photos: allPhotos
                };
            });
            
            allProjects = [...projectsCards];
            totalCards = projectsCards.length;
        } else {
            createRandomCards();
        }
    } catch (error) {
        createRandomCards();
    }
}

function createRandomCards() {
    // პროექტები არ არის - ცარიელი მასივი
    projectsCards = [];
    allProjects = [];
    totalCards = 0;
    
    // შეტყობინების ჩვენება
    const container = document.getElementById('cardsWrapper');
    if (container) {
        replaceWithMessage(container, 'პროექტები ჯერ არ არის დამატებული');
    }
}

function renderProjectsCards() {
    if (!cardsContainer || !projectsCards.length) return;
    cardsContainer.replaceChildren();
    projectsCards.forEach((card, index) => {
        cardsContainer.appendChild(createCardElement(card, index));
    });
}

function createCardElement(card, index) {
    const cardElement = document.createElement('div');
    cardElement.className = 'project-card';
    cardElement.setAttribute('data-original-index', index);
    cardElement.setAttribute('data-project-id', card.id);
    
    // Lazy loading - სურათი ჩაიტვირთება როცა ხილული გახდება
    const safeBackgroundUrl = getSafeUploadedImageUrl(card.image);
    if (safeBackgroundUrl) {
        cardElement.dataset.bgImage = safeBackgroundUrl;
        cardElement.style.backgroundSize = 'cover';
        cardElement.style.backgroundPosition = 'center';
        cardElement.style.backgroundRepeat = 'no-repeat';
        cardElement.style.backgroundColor = '#e0e0e0'; // placeholder ფერი
        lazyImageObserver.observe(cardElement);
    }

    const cardInfo = document.createElement('div');
    cardInfo.className = 'card-info';

    const cardArea = document.createElement('div');
    cardArea.className = 'card-area';
    cardArea.textContent = String(card.area || '');
    cardInfo.appendChild(cardArea);

    if (card.title) {
        const title = document.createElement('div');
        title.className = 'card-title';
        title.hidden = true;
        title.textContent = String(card.title);
        cardInfo.appendChild(title);
    }
    if (card.description) {
        const description = document.createElement('div');
        description.className = 'card-description';
        description.hidden = true;
        description.textContent = String(card.description);
        cardInfo.appendChild(description);
    }
    cardElement.appendChild(cardInfo);

    if (window.userAuthenticated) {
        const likeButton = createLikeButton('like-btn', card.id, card.is_liked);
        if (likeButton) cardElement.appendChild(likeButton);
    }
    
    cardElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Store the original index of the card
        card.originalIndex = index;
        
        // Navigate to gallery page with card data
        openGalleryForCard(card);
    });
    
    // Add like button click event listener
    const likeBtn = cardElement.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLikeClick(card.id, likeBtn);
        });
    }
    
    return cardElement;
}

function moveCarousel(direction) {
    if (!cardsContainer) return;
    const projectCards = cardsContainer.querySelectorAll('.project-card');
    if (!projectCards.length) return;
    
    // მარტივი ნავიგაცია - ინდექსი შემოფარგლული ქარდების რაოდენობით
    currentCardIndex = Math.max(0, Math.min(projectCards.length - 1, currentCardIndex + direction));
    projectCards[currentCardIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// ძებნის რეჟიმში შემდეგ/წინა ნაპოვნ პროექტზე გადასვლა
function moveToNextFoundProject(direction) {
    if (filteredProjects.length === 0) return;
    
    // მიმდინარე ნაპოვნი პროექტის ინდექსის განახლება
    searchCurrentIndex += direction;
    
    // ციკლური ნავიგაცია
    if (searchCurrentIndex >= filteredProjects.length) {
        searchCurrentIndex = 0;
    } else if (searchCurrentIndex < 0) {
        searchCurrentIndex = filteredProjects.length - 1;
    }
    
    // შემდეგი ნაპოვნი პროექტის ქარდის პოვნა
    const targetProject = filteredProjects[searchCurrentIndex];
    const cardsContainer = document.querySelector('.cards-container');
    const projectCards = cardsContainer.querySelectorAll('.project-card');
    
    const targetCard = Array.from(projectCards).find(card => 
        card.dataset.projectId == targetProject.id
    );
    
    if (targetCard) {
        scrollToCard(targetCard);
    }
    
    setTimeout(() => {
        projectsIsTransitioning = false;
    }, 500);
}

// resetCarouselPositionIfNeeded წაშლილია - აღარ არის საჭირო მარტივი კარუსელისთვის

function updateCarouselPosition() {
    if (!cardsContainer) return;
    const cards = cardsContainer.querySelectorAll('.project-card');
    if (!cards.length) return;
    // center by direct scrollLeft math to avoid unexpected snapping
    const card = cards[currentCardIndex];
    const cardRect = card.getBoundingClientRect();
    const containerRect = cardsContainer.getBoundingClientRect();
    const delta = (cardRect.left + cardRect.width / 2) - (containerRect.left + containerRect.width / 2);
    cardsContainer.scrollLeft += delta;
}

function updateCarouselButtons() {
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (prevBtn && nextBtn) {
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }
}

    // --- გალერიის ფუნქციონალი ---
function openGalleryForCard(card) {
    // Store card data for gallery modal
    window.selectedCard = card;
    
    // Open gallery modal
    openGalleryModal(card);
}

    // --- გალერიის მოდალური ფანჯრის ფუნქციონალი ---
let galleryCurrentSlide = 0;
let gallerySlides = [];
let galleryDots = [];
let galleryTotalSlides = 0;

function initGalleryModal() {
    const galleryModal = document.getElementById('galleryModal');
    const galleryCloseBtn = document.getElementById('galleryCloseBtn');
    const galleryPrevBtn = document.getElementById('galleryPrevBtn');
    const galleryNextBtn = document.getElementById('galleryNextBtn');
    
    if (!galleryModal) return;
    
    // Event listeners
        if (galleryCloseBtn) galleryCloseBtn.addEventListener('click', closeGalleryModal);
        if (galleryPrevBtn) galleryPrevBtn.addEventListener('click', () => changeGallerySlide(-1));
        if (galleryNextBtn) galleryNextBtn.addEventListener('click', () => changeGallerySlide(1));
    
    // Close modal when clicking outside
    galleryModal.addEventListener('click', (e) => {
        if (e.target === galleryModal) closeGalleryModal();
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (galleryModal.classList.contains('active')) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                changeGallerySlide(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                changeGallerySlide(1);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeGalleryModal();
            }
        }
    });
}

// Open gallery modal
function openGalleryModal(card) {
    const galleryModal = document.getElementById('galleryModal');
    const gallery = document.getElementById('gallery');
    const noPhotos = document.getElementById('galleryNoPhotos');
    
    if (!galleryModal) return;
    
    // Show modal
    galleryModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load gallery photos from selected card
    loadGalleryPhotosForModal();
}

// Load gallery photos for modal
function loadGalleryPhotosForModal() {
    const gallery = document.getElementById('gallery');
    const noPhotos = document.getElementById('galleryNoPhotos');
    
    try {
        if (window.selectedCard?.photos?.length > 0) {
            const renderedPhotoCount = displayGalleryPhotos(window.selectedCard.photos);
            if (renderedPhotoCount > 0) {
                gallery.style.display = 'block';
                noPhotos.classList.add('hidden');
                return;
            }
        }
        gallery.style.display = 'none';
        noPhotos.classList.remove('hidden');
    } catch (error) {
        gallery.style.display = 'none';
        noPhotos.classList.remove('hidden');
    }
}

// Close gallery modal
function closeGalleryModal() {
    const galleryModal = document.getElementById('galleryModal');
    if (!galleryModal) return;
    
    galleryModal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Clear selected card
    window.selectedCard = null;
}

// Display photos in gallery
function displayGalleryPhotos(photos) {
    const carouselContainer = document.getElementById('galleryCarouselContainer');
    const dotsContainer = document.getElementById('galleryDots');
    
    if (!carouselContainer || !dotsContainer) return 0;

    carouselContainer.replaceChildren();
    dotsContainer.replaceChildren();

    const safePhotos = (Array.isArray(photos) ? photos : [])
        .map(photo => getSafeUploadedImageUrl(typeof photo === 'string' ? photo : photo?.url))
        .filter(Boolean);

    safePhotos.forEach((photoUrl, index) => {
        const slide = document.createElement('div');
        slide.className = `slide ${index === 0 ? 'active' : ''}`;

        const image = createUploadedImage(
            photoUrl,
            `Photo ${index + 1}`,
            '',
            index === 0 ? 'eager' : 'lazy'
        );
        if (!image) return;
        slide.appendChild(image);

        if (window.userAuthenticated && window.selectedCard) {
            const likeButton = createLikeButton(
                'gallery-like-btn',
                window.selectedCard.id,
                window.selectedCard.is_liked,
                24
            );
            if (likeButton) {
                likeButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleLikeClick(window.selectedCard.id, likeButton);
                });
                slide.appendChild(likeButton);
            }
        }

        carouselContainer.appendChild(slide);
        
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => goToGallerySlide(index));
        dotsContainer.appendChild(dot);
    });
    
    gallerySlides = document.querySelectorAll('#galleryCarouselContainer .slide');
    galleryDots = document.querySelectorAll('#galleryDots .dot');
    galleryTotalSlides = safePhotos.length;
    galleryCurrentSlide = 0;
    return galleryTotalSlides;
}

// Show specific slide
function showGallerySlide(index) {
    if (!gallerySlides || gallerySlides.length === 0) return;
    
    gallerySlides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
    
    if (galleryDots && galleryDots.length > 0) {
        galleryDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }
    
    galleryCurrentSlide = index;
}

// Change slide (previous/next)
function changeGallerySlide(direction) {
    if (galleryTotalSlides === 0) return;
    
    galleryCurrentSlide += direction;
    if (galleryCurrentSlide >= galleryTotalSlides) {
        galleryCurrentSlide = 0;
    } else if (galleryCurrentSlide < 0) {
        galleryCurrentSlide = galleryTotalSlides - 1;
    }
    showGallerySlide(galleryCurrentSlide);
}

// Go to specific slide
function goToGallerySlide(index) {
    if (index >= 0 && index < galleryTotalSlides) {
        showGallerySlide(index);
    }
}

    // --- მოწონების ფუნქციონალი (Optimistic UI) ---
async function handleLikeClick(projectId, likeButton) {
    if (!window.userAuthenticated) {
        Toast.warning('შესვლა გჭირდებათ პროექტის მოსაწონებლად.');
        return;
    }
    
    // მიმდინარე მდგომარეობა (revert-ისთვის)
    const wasLiked = likeButton.classList.contains('liked');
    const newLikedState = !wasLiked;
    
    // 🚀 Optimistic Update - მაშინვე ვიზუალური განახლება
    updateAllLikeButtonsForProject(projectId, newLikedState);
    
    try {
        const response = await secureFetch(`/api/projects/${projectId}/like`, { method: 'POST' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            // სერვერის პასუხით განახლება (likes_count სწორი იქნება)
            updateProjectCardData(projectId, data.liked, data.likes_count);
            
            const eventName = data.liked ? 'projectLiked' : 'projectUnliked';
            const storageKey = data.liked ? 'projectLiked' : 'projectUnliked';
            
            localStorage.setItem(storageKey, JSON.stringify({ projectId, timestamp: Date.now() }));
            window.dispatchEvent(new CustomEvent(eventName, { detail: { projectId } }));
        } else {
            // ❌ შეცდომა - დავაბრუნოთ წინა მდგომარეობა
            updateAllLikeButtonsForProject(projectId, wasLiked);
            
            if (response.status === 401) {
                Toast.warning('შესვლა გჭირდებათ პროექტის მოსაწონებლად.');
            } else {
                Toast.error(`შეცდომა: ${data.error || 'შეცდომა მოწონებისას'}`);
            }
        }
    } catch (error) {
        // ❌ შეცდომა - დავაბრუნოთ წინა მდგომარეობა
        updateAllLikeButtonsForProject(projectId, wasLiked);
        Toast.error('შეცდომა სერვერთან კავშირისას.');
    }
}

// ყველა ლაიქის ღილაკის განახლება იგივე პროექტისთვის
function updateAllLikeButtonsForProject(projectId, isLiked) {
    const expectedProjectId = String(projectId);
    document.querySelectorAll('[data-project-id]').forEach(button => {
        if (button.dataset.projectId !== expectedProjectId) return;
        if (button.classList.contains('like-btn') || button.classList.contains('gallery-like-btn')) {
            const svg = button.querySelector('svg');
            if (svg) {
                button.classList.toggle('liked', isLiked);
                svg.setAttribute('fill', isLiked ? '#ffffff' : 'none');
                svg.setAttribute('stroke', '#ffffff');
            }
        }
    });
}

// მოწონების ღილაკის ვიზუალური მდგომარეობის განახლება
function updateLikeButton(likeButton, isLiked, likesCount) {
    updateAllLikeButtonsForProject(likeButton.getAttribute('data-project-id'), isLiked);
}

// პროექტის ქარდის მონაცემების განახლება projectsCards მასივში
function updateProjectCardData(projectId, isLiked, likesCount) {
    projectsCards.forEach(card => {
        if (card.id == projectId) {
            card.is_liked = isLiked;
            card.likes_count = likesCount;
        }
    });
    
    // ასევე განაახლოს window.selectedCard (თუ ეს იგივე პროექტია)
    if (window.selectedCard && window.selectedCard.id == projectId) {
        window.selectedCard.is_liked = isLiked;
        window.selectedCard.likes_count = likesCount;
    }
    
    // სინქრონიზაცია ახლა updateLikeButton ფუნქციით ხდება
}


    // --- რეალ-ტაიმ განახლების ფუნქციონალი ---
    function setupRealtimeUpdates() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'projectLiked' || e.key === 'projectUnliked') {
                const data = JSON.parse(e.newValue);
                updateAllLikeButtonsForProject(data.projectId, e.key === 'projectLiked');
            }
        });
        
        window.addEventListener('projectLiked', (e) => updateAllLikeButtonsForProject(e.detail.projectId, true));
        window.addEventListener('projectUnliked', (e) => updateAllLikeButtonsForProject(e.detail.projectId, false));
    }

    // --- ყველაფრის ინიციალიზაცია ---
    checkAuthStatus();
    initProjectsCarousel().catch(() => {});
    initSection3Projects().catch(() => {});
    if (!document.getElementById('likedProjectsGrid')) {
        initGalleryModal();
    }
    setupRealtimeUpdates();
    initSearchFunctionality();
});

// ადმინის პანელის გახსნა
function openAdminPanel() {
    // გახსნას ადმინის გვერდი იგივე ფანჯარაში
    window.location.href = '/admin';
}

// ===== კარუსელის ფოტოების ჩატვირთვის ფუნქცია =====
async function loadCarouselImages() {
    try {
        const response = await fetch('/api/carousel');
        if (!response.ok) throw new Error('API error');
        
        const data = await response.json();
        if (data.success && data.images?.length > 0) {
            renderCarouselImages(data.images);
        }
        // თუ ფოტოები არ არის, კარუსელი უბრალოდ ცარიელი რჩება
    } catch (error) {
        // შეცდომის შემთხვევაში არაფერი არ ვაკეთოთ
    }
}

// კარუსელის ფოტოების რენდერი API-დან
function renderCarouselImages(images) {
    const carouselContainer = document.getElementById('carouselContainer');
    if (!carouselContainer) return;

    const sortedImages = (Array.isArray(images) ? images : [])
        .map(image => ({ image, safeUrl: getSafeUploadedImageUrl(image?.url) }))
        .filter(item => item.safeUrl)
        .sort((a, b) => Number(a.image.order || 0) - Number(b.image.order || 0));

    carouselContainer.replaceChildren();
    sortedImages.forEach(({ safeUrl }, index) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.classList.toggle('active', index === 0);

        const image = createUploadedImage(
            safeUrl,
            'კარუსელის ფოტო',
            '',
            index === 0 ? 'eager' : 'lazy'
        );
        if (image) slide.appendChild(image);
        carouselContainer.appendChild(slide);
    });
    
    // კარუსელის ინიციალიზაცია
    initMainCarousel();
}

// მთავარი კარუსელის ინიციალიზაცია
let carouselInterval = null;

function initMainCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    let currentSlide = 0;

    // წინა interval-ის გასუფთავება (memory leak-ის თავიდან აცილება)
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
    if (slides.length < 2) return;
    
    // ავტომატური სლაიდების შეცვლა
    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }
    
    // კარუსელის ავტომატური გაშვება (5 წამში ერთხელ)
    carouselInterval = setInterval(nextSlide, 5000);
}

// ===== ძებნის ფუნქციონალი =====
let allProjects = [];
let filteredProjects = [];
let currentSearchTerm = '';
let searchMode = false;
let searchCurrentIndex = 0;

function initSearchFunctionality() {
    const searchInput = document.getElementById('projectSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (!searchInput || !searchBtn || !clearSearchBtn) return;
    
    function performSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        currentSearchTerm = searchTerm;
        
        if (searchTerm.length < 2) {
            clearSearch();
            return;
        }
        
        filteredProjects = allProjects.filter(p => 
            String(p.title || '').toLowerCase().includes(searchTerm) ||
            String(p.description || '').toLowerCase().includes(searchTerm) ||
            String(p.area || '').toLowerCase().includes(searchTerm)
        );
        
        searchMode = true;
        searchCurrentIndex = 0;
        updateCarouselDisplay();
        
        searchBtn.classList.add('hidden');
        clearSearchBtn.classList.remove('hidden');
    }
    
    function clearSearch() {
        searchInput.value = '';
        currentSearchTerm = '';
        filteredProjects = [];
        searchMode = false;
        searchCurrentIndex = 0;
        updateCarouselDisplay();
        
        searchBtn.classList.remove('hidden');
        clearSearchBtn.classList.add('hidden');
    }
    
    function updateCarouselDisplay() {
        const cardsContainer = document.querySelector('.cards-container');
        if (!cardsContainer) return;
        
        const projectCards = cardsContainer.querySelectorAll('.project-card');
        let noResultsMessage = cardsContainer.querySelector('.search-no-results');
        
        if (searchMode) {
            projectCards.forEach(card => {
                const isFound = filteredProjects.some(p => p.id == card.dataset.projectId);
                card.style.display = isFound ? 'block' : 'none';
                card.classList.toggle('search-highlighted', isFound);
            });

            if (filteredProjects.length === 0) {
                if (!noResultsMessage) {
                    noResultsMessage = document.createElement('p');
                    noResultsMessage.className = 'search-no-results';
                    noResultsMessage.style.cssText = 'width: 100%; text-align: center; padding: 40px; color: #666;';
                    cardsContainer.appendChild(noResultsMessage);
                }
                noResultsMessage.textContent = `„${currentSearchTerm}“-ისთვის პროექტი ვერ მოიძებნა`;
                cardsContainer.style.transform = 'translateX(0px)';
            } else {
                if (noResultsMessage) noResultsMessage.remove();
                const firstFoundCard = cardsContainer.querySelector('.project-card.search-highlighted');
                if (firstFoundCard) scrollToCard(firstFoundCard);
            }
        } else {
            if (noResultsMessage) noResultsMessage.remove();
            projectCards.forEach(card => {
                card.style.display = 'block';
                card.style.opacity = '1';
                card.classList.remove('search-highlighted');
            });
            cardsContainer.style.transform = 'translateX(0px)';
        }
    }
    
    searchBtn.addEventListener('click', performSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });
    searchInput.addEventListener('input', function() {
        if (this.value.trim().length >= 2) performSearch();
        else if (this.value.trim().length === 0) clearSearch();
    });
}

// კონკრეტულ ქარდზე სქროლვის ფუნქცია (გლობალური)
function scrollToCard(targetCard) {
    const container = document.getElementById('cardsWrapper');
    if (!container || !targetCard) return;
    
    // იყენებს კონტეინერის scrollLeft-ს გვერდის სქროლვის ნაცვლად
    const containerRect = container.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();
    const scrollLeft = cardRect.left - containerRect.left + container.scrollLeft - (containerRect.width / 2) + (cardRect.width / 2);
    
    container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
    });
}

// სექცია 2-ის ისრების ფუნქციონალი
function initSection2Arrows() {
    const prevBtn = document.getElementById('section2PrevBtn');
    const nextBtn = document.getElementById('section2NextBtn');
    const container = document.getElementById('cardsWrapper');
    
    if (!prevBtn || !nextBtn || !container) return;
    
    // ყველაზე ახლო ქარდის პოვნა ცენტრთან
    function findClosestCard(cards) {
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        let closestCard = null, minDistance = Infinity;
        
        cards.forEach(card => {
            const cardRect = card.getBoundingClientRect();
            const distance = Math.abs(cardRect.left + cardRect.width / 2 - containerCenter);
            if (distance < minDistance) {
                minDistance = distance;
                closestCard = card;
            }
        });
        return closestCard;
    }
    
    // ნავიგაცია მითითებული მიმართულებით
    function navigate(direction) {
        const cards = Array.from(container.querySelectorAll('.project-card'))
            .filter(card => card.style.display !== 'none');
        if (cards.length === 0) return;
        
        const closestCard = findClosestCard(cards);
        if (!closestCard) return;
        
        const currentIndex = cards.indexOf(closestCard);
        const newIndex = direction === -1 
            ? (currentIndex > 0 ? currentIndex - 1 : cards.length - 1)
            : (currentIndex < cards.length - 1 ? currentIndex + 1 : 0);
        
        scrollToCard(cards[newIndex]);
    }
    
    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"'`=\/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c]));
}
