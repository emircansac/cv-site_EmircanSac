// ============================================
// CV Website Scroll Routing Logic
// ============================================

// Get DOM elements
const sectionsWrapper = document.querySelector('.sections-wrapper');
const sections = document.querySelectorAll('.cv-section');
const sectionContents = document.querySelectorAll('.section-content');
const navButtons = document.querySelectorAll('.nav-button');
const langButtons = document.querySelectorAll('.lang-button');
let navCardContainer = null;
let navCardItems = [];
let navBackdrop = null;

// Scroll state management
let isNavigating = false; // Prevents navigation during scroll animation
let navigationTimeout = null;
let lastWheelTime = 0; // Timestamp of last wheel event that triggered navigation
const WHEEL_COOLDOWN = 100; // Minimum ms between horizontal navigations (debounce fast scrolls)
let targetSection = 0; // The section we're navigating to (used during animation)
let navigationSource = null; // 'wheel' | 'nav' | null
const DEBUG_NAV = true;

// Navigation mode state
let navMode = 'card'; // 'card' | 'section'

// CRITICAL FIX: Force wrapper to viewport width so content can overflow
if (sectionsWrapper && sections.length > 0) {
    const viewportWidth = window.innerWidth;
    sectionsWrapper.style.width = viewportWidth + 'px';
    sectionsWrapper.style.maxWidth = viewportWidth + 'px';
    
    console.log('[HORIZONTAL SCROLL FIX]', {
        viewportWidth: viewportWidth,
        sectionsCount: sections.length,
        expectedScrollWidth: viewportWidth * sections.length
    });
}


/** Tolerance for vertical scroll boundary detection (rounding, padding, image loading) */
const SCROLL_TOLERANCE = 8;

// ============================================
// Mobile Detection
// ============================================

/**
 * Detects if the current device is mobile (based on viewport width)
 * @returns {boolean} True if mobile device
 */
function isMobile() {
    return window.innerWidth <= 768;
}

/**
 * Checks if user prefers reduced motion
 * @returns {boolean} True if reduced motion is preferred
 */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ============================================
// Navigation Mode (Card vs Section)
// ============================================

/**
 * Applies navigation mode to the UI.
 * @param {'card' | 'section'} mode
 */
function setNavMode(mode) {
    navMode = mode;
    document.body.classList.toggle('nav-mode-card', mode === 'card');
    document.body.classList.toggle('nav-mode-section', mode === 'section');
    const sectionNav = document.querySelector('.section-nav');
    if (sectionNav) {
        sectionNav.classList.toggle('is-docked', mode === 'section');
    }
    if (navBackdrop) {
        navBackdrop.classList.toggle('is-visible', mode === 'card');
    }
}

/**
 * Transitions from card mode into section mode.
 * @param {number} [sectionIndex]
 */
function enterSectionMode(sectionIndex) {
    setNavMode('section');
    if (typeof sectionIndex === 'number') {
        scrollToSection(sectionIndex);
    }
}

/**
 * Returns to the centered navigation card.
 */
function returnToCardMode() {
    setNavMode('card');
}

// ============================================
// Stage 1: Detect Currently Active Section
// ============================================

/**
 * Determines which section is currently visible/active based on scroll position
 * @returns {number} Index of the active section (0-5)
 */
function getCurrentSection() {
    // During navigation, use targetSection to avoid mid-animation calculation errors
    if (isNavigating) {
        return targetSection;
    }
    
    const scrollLeft = sectionsWrapper.scrollLeft;
    const viewportWidth = window.innerWidth;
    
    // Calculate which section is currently in view
    // Each section is 100vw wide, so we divide scroll position by viewport width
    const rawIndex = scrollLeft / viewportWidth;
    const sectionIndex = Math.round(rawIndex);
    
    const result = Math.max(0, Math.min(sectionIndex, sections.length - 1));
    
    if (DEBUG_NAV) {
        console.log('[GET_CURRENT]', {
            scrollLeft: Math.round(scrollLeft),
            viewportWidth,
            rawIndex: rawIndex.toFixed(2),
            rounded: sectionIndex,
            result,
            isNavigating
        });
    }
    
    // Clamp to valid range (0 to sections.length - 1)
    return result;
}

/**
 * Gets the section-content element for the currently active section
 * @returns {HTMLElement|null} The section-content element or null
 */
function getCurrentSectionContent() {
    const currentIndex = getCurrentSection();
    return sectionContents[currentIndex] || null;
}

// ============================================
// Stage 2: Check Vertical Scroll Capability
// ============================================

/**
 * Checks if the current section's content can scroll vertically
 * @param {HTMLElement} sectionContent - The section-content element to check
 * @returns {boolean} True if content can scroll vertically
 */
function canScrollVertically(sectionContent) {
    if (!sectionContent) {
        return false;
    }
    
    // Content can scroll only if there is real overflow (tolerance of 2px)
    const canScroll = sectionContent.scrollHeight > sectionContent.clientHeight + 2;
    return canScroll;
}

/**
 * Checks if vertical scroll is at the top boundary
 * @param {HTMLElement} sectionContent - The section-content element to check
 * @returns {boolean} True if scrolled to top
 */
function isAtTop(sectionContent) {
    if (!sectionContent) return true;
    return sectionContent.scrollTop <= SCROLL_TOLERANCE;
}

/**
 * Checks if vertical scroll is at the bottom boundary
 * @param {HTMLElement} sectionContent - The section-content element to check
 * @returns {boolean} True if scrolled to bottom
 */
function isAtBottom(sectionContent) {
    if (!sectionContent) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = sectionContent;
    return scrollTop + clientHeight >= scrollHeight - SCROLL_TOLERANCE;
}

// ============================================
// Stage 3: Route Mouse Wheel Events
// ============================================

/**
 * Handles mouse wheel events with vertical-first priority
 * @param {WheelEvent} event - The wheel event
 */
function handleWheelEvent(event) {
    if (DEBUG_NAV) {
        console.log('[SCROLL ENTER]', { 
            target: event.target.className || event.target.tagName, 
            isNavigating, 
            navigationSource 
        });
    }
    
    // CRITICAL: Block ALL wheel events during nav-button-initiated navigation
    if (navigationSource === 'nav') {
        event.preventDefault();
        if (DEBUG_NAV) console.log('[SCROLL BLOCKED]', 'Nav button navigation in progress');
        return;
    }
    
    // Block events during navigation animation
    if (isNavigating) {
        event.preventDefault();
        if (DEBUG_NAV) console.log('[SCROLL BLOCKED]', 'Navigation in progress');
        return;
    }
    
    // Disable custom scroll routing on mobile
    if (isMobile()) {
        return; // Let browser handle scrolling naturally
    }

    // Card mode: scrolling down enters section mode
    if (navMode === 'card') {
        if (event.deltaY > 0) {
            navigationSource = 'wheel';
            enterSectionMode(getCurrentSection());
            event.preventDefault();
        }
        return;
    }
    
    // Whitelist: only handle scroll when target is inside .section-content (exclude language-switcher, nav, fixed UI)
    const targetContent = event.target.closest('.section-content');
    if (!targetContent) {
        if (DEBUG_NAV) console.log('[SCROLL SKIP]', 'Not inside section-content');
        return; // Not inside a section-content, allow native scroll
    }
    
    const currentIndex = isNavigating ? targetSection : getCurrentSection();
    const currentSectionContent = targetContent || getCurrentSectionContent();
    
    // Check if current section can scroll vertically
    const canScroll = canScrollVertically(currentSectionContent);
    
    if (canScroll && currentSectionContent) {
        // Stage 3a: Vertical scrolling is possible
        const deltaY = event.deltaY;
        const isScrollingUp = deltaY < 0;
        const isScrollingDown = deltaY > 0;
        
        // Check current scroll position
        const atTop = isAtTop(currentSectionContent);
        const atBottom = isAtBottom(currentSectionContent);
        
        // Hide scroll hint when vertical scrolling starts
        if (!atTop || isScrollingDown) {
            hideScrollHint(currentIndex);
        }
        
        // Stage 3b: Route based on scroll boundaries
        if (isScrollingUp && atTop) {
            if (navMode === 'section') {
                if (DEBUG_NAV) console.log('[SCROLL TO CARD]', 'top boundary reached');
                returnToCardMode();
                event.preventDefault();
                return;
            }
            // Check cooldown
            const now = Date.now();
            if (now - lastWheelTime < WHEEL_COOLDOWN) {
                if (DEBUG_NAV) console.log('[SCROLL COOLDOWN]', 'prev blocked');
                event.preventDefault();
                return;
            }
            
            if (DEBUG_NAV) console.log('[SCROLL HORIZONTAL]', 'prev', 'source: wheel');
            lastWheelTime = now;
            navigationSource = 'wheel';
            // At top, scrolling up → navigate to previous section
            navigateToPreviousSection();
            event.preventDefault();
        } else if (isScrollingDown && atBottom) {
            // Check cooldown
            const now = Date.now();
            if (now - lastWheelTime < WHEEL_COOLDOWN) {
                if (DEBUG_NAV) console.log('[SCROLL COOLDOWN]', 'next blocked');
                event.preventDefault();
                return;
            }
            
            if (DEBUG_NAV) console.log('[SCROLL HORIZONTAL]', 'next', 'source: wheel');
            lastWheelTime = now;
            navigationSource = 'wheel';
            // At bottom, scrolling down → navigate to next section
            navigateToNextSection();
            event.preventDefault();
        } else {
            if (DEBUG_NAV) console.log('[SCROLL VERTICAL]');
            // Within scrollable range → allow default vertical scroll
            return;
        }
    } else {
        // Check cooldown
        const now = Date.now();
        if (now - lastWheelTime < WHEEL_COOLDOWN) {
            if (DEBUG_NAV) console.log('[SCROLL COOLDOWN]', 'no-vertical blocked');
            event.preventDefault();
            return;
        }
        
        // Stage 3c: No vertical scroll possible → navigate horizontally
        const deltaY = event.deltaY;
        
        if (deltaY < 0) {
            if (DEBUG_NAV) console.log('[SCROLL HORIZONTAL]', 'prev', 'source: wheel');
            lastWheelTime = now;
            navigationSource = 'wheel';
            // Scrolling up → previous section
            navigateToPreviousSection();
            event.preventDefault();
        } else if (deltaY > 0) {
            if (DEBUG_NAV) console.log('[SCROLL HORIZONTAL]', 'next', 'source: wheel');
            lastWheelTime = now;
            navigationSource = 'wheel';
            // Scrolling down → next section
            navigateToNextSection();
            event.preventDefault();
        }
        // If deltaY === 0, allow default (no preventDefault)
    }
}

// ============================================
// Stage 4: Horizontal Navigation Functions
// ============================================

/**
 * Navigates to the next section horizontally
 */
function navigateToNextSection() {
    if (isNavigating) {
        if (DEBUG_NAV) console.log('[NAV NEXT] Blocked: already navigating to section', targetSection);
        return;
    }
    
    const currentIndex = getCurrentSection();
    const nextIndex = Math.min(currentIndex + 1, sections.length - 1);
    
    if (DEBUG_NAV) {
        console.log('[NAV NEXT]', {
            currentIndex,
            nextIndex,
            scrollLeft: Math.round(sectionsWrapper.scrollLeft),
            navigationSource
        });
    }
    
    if (nextIndex !== currentIndex) {
        scrollToSection(nextIndex);
    } else {
        if (DEBUG_NAV) console.log('[NAV NEXT] Already at last section');
    }
}

/**
 * Navigates to the previous section horizontally
 */
function navigateToPreviousSection() {
    if (isNavigating) {
        if (DEBUG_NAV) console.log('[NAV PREV] Blocked: already navigating to section', targetSection);
        return;
    }
    
    const currentIndex = getCurrentSection();
    const prevIndex = Math.max(currentIndex - 1, 0);
    
    if (DEBUG_NAV) {
        console.log('[NAV PREV]', {
            currentIndex,
            prevIndex,
            scrollLeft: Math.round(sectionsWrapper.scrollLeft),
            navigationSource
        });
    }
    
    if (prevIndex !== currentIndex) {
        scrollToSection(prevIndex);
    } else {
        if (DEBUG_NAV) console.log('[NAV PREV] Already at first section');
    }
}

/**
 * Scrolls to a specific section by index
 * @param {number} index - Section index (0-5)
 */
function scrollToSection(index) {
    // Don't use custom scrolling on mobile
    if (isMobile()) {
        if (DEBUG_NAV) console.log('[SCROLLTO] Skipped: mobile mode');
        return;
    }
    
    // Prevent overlapping navigations
    if (isNavigating) {
        if (DEBUG_NAV) console.log('[SCROLLTO] Blocked: already navigating');
        return;
    }
    
    const viewportWidth = window.innerWidth;
    const targetScrollLeft = index * viewportWidth;
    
    if (DEBUG_NAV) {
        console.log('[SCROLLTO]', {
            index: index,
            source: navigationSource,
            viewportWidth: viewportWidth,
            targetScrollLeft: targetScrollLeft,
            currentScrollLeft: Math.round(sectionsWrapper.scrollLeft)
        });
    }
    
    // Set navigation lock
    isNavigating = true;
    targetSection = index;
    
    // Clear any existing timeout
    if (navigationTimeout) {
        clearTimeout(navigationTimeout);
    }
    
    // Respect reduced motion preference
    const scrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
    const animationDuration = scrollBehavior === 'smooth' ? 800 : 50;
    
    sectionsWrapper.scrollTo({
        left: targetScrollLeft,
        behavior: scrollBehavior
    });
    
    // Release lock after animation completes
    navigationTimeout = setTimeout(() => {
        isNavigating = false;
        navigationSource = null;
        targetSection = index;
        
        if (DEBUG_NAV) {
            console.log('[SCROLLTO COMPLETE]', {
                actualScrollLeft: Math.round(sectionsWrapper.scrollLeft),
                targetScrollLeft,
                targetSection,
                success: Math.abs(sectionsWrapper.scrollLeft - targetScrollLeft) < 10
            });
        }
    }, animationDuration);
}

// ============================================
// Stage 5: Active Section Highlighting
// ============================================

/**
 * Updates the active state of navigation buttons based on current section
 */
function updateActiveSection() {
    const currentIndex = getCurrentSection();
    
    navButtons.forEach((button, index) => {
        if (index === currentIndex) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    if (navCardItems.length) {
        navCardItems.forEach((card, index) => {
            card.classList.toggle('is-active', index === currentIndex);
        });
    }
}

// ============================================
// Stage 6: Scroll Hint Management
// ============================================

/**
 * Creates and adds scroll hints to sections that have scrollable content
 */
function initScrollHints() {
    requestAnimationFrame(() => {
        sectionContents.forEach((content, index) => {
            // Only add hint if content can scroll vertically
            if (content.scrollHeight > content.clientHeight) {
                const hint = document.createElement('div');
                hint.className = 'scroll-hint';
                // Create bilingual hint content
                const trHint = document.createElement('span');
                trHint.setAttribute('data-lang', 'tr');
                trHint.textContent = 'Detaylar için kaydır ↓';
                const enHint = document.createElement('span');
                enHint.setAttribute('data-lang', 'en');
                enHint.style.display = 'none';
                enHint.textContent = 'Scroll for details ↓';
                hint.appendChild(trHint);
                hint.appendChild(enHint);
                sections[index].appendChild(hint);
            }
        });
    });
}

/**
 * Hides scroll hint for a specific section
 * @param {number} sectionIndex - Index of the section
 */
function hideScrollHint(sectionIndex) {
    const section = sections[sectionIndex];
    const hint = section.querySelector('.scroll-hint');
    if (hint) {
        hint.classList.add('hidden');
    }
}

/**
 * Shows scroll hint for a specific section (if it exists)
 * @param {number} sectionIndex - Index of the section
 */
function showScrollHint(sectionIndex) {
    const section = sections[sectionIndex];
    const hint = section.querySelector('.scroll-hint');
    if (hint) {
        // Only show if at top of section
        const content = sectionContents[sectionIndex];
        if (content && isAtTop(content)) {
            hint.classList.remove('hidden');
        }
    }
}

// ============================================
// Initialize Event Listeners
// ============================================

/**
 * Handles scroll events on section content to hide hints
 */
function handleSectionContentScroll(event) {
    const sectionContent = event.target;
    const sectionIndex = Array.from(sectionContents).indexOf(sectionContent);
    
    if (sectionIndex !== -1) {
        // Hide hint when user starts scrolling
        if (sectionContent.scrollTop > 0) {
            hideScrollHint(sectionIndex);
        } else {
            // Show hint again if scrolled back to top
            showScrollHint(sectionIndex);
        }
    }
}

/**
 * Handles horizontal scroll to update active section
 */
function handleHorizontalScroll() {
    // Skip on mobile (no horizontal scrolling)
    if (isMobile()) {
        return;
    }
    
    updateActiveSection();
    
    // Show scroll hint for new section if at top
    const currentIndex = getCurrentSection();
    showScrollHint(currentIndex);
}

/**
 * Initializes scroll event handlers
 */
function initScrollHandlers() {
    
    // Only initialize custom scroll routing on desktop
    if (!isMobile()) {
        // Listen for wheel events on the sections wrapper
        sectionsWrapper.addEventListener('wheel', handleWheelEvent, { passive: false });
        window.addEventListener('wheel', (event) => {
            if (navMode === 'card' && !isMobile()) {
                handleWheelEvent(event);
            }
        }, { passive: false, capture: true });
        
        // Listen for horizontal scroll to update active section
        sectionsWrapper.addEventListener('scroll', handleHorizontalScroll);
        
        // Initialize scroll hints
        initScrollHints();
        
        // Set initial active section
        updateActiveSection();
        
        // Add click handlers to navigation buttons
        navButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                if (isNavigating) {
                    if (DEBUG_NAV) console.log('[NAV CLICK] Blocked: already navigating');
                    return;
                }
                
                const targetSectionIndex = parseInt(button.dataset.section) || index;
                
                if (DEBUG_NAV) {
                    console.log('[NAV CLICK]', {
                        buttonIndex: index,
                        dataSection: button.dataset.section,
                        targetSection: targetSectionIndex,
                        navigationSource: 'nav',
                        isMobile: isMobile()
                    });
                }
                
                navigationSource = 'nav';
                if (navMode === 'card') {
                    enterSectionMode(targetSectionIndex);
                    return;
                }
                scrollToSection(targetSectionIndex);
            });
        });
    }
    
    // Listen for vertical scroll on each section content to hide hints (works on both mobile and desktop)
    sectionContents.forEach(content => {
        content.addEventListener('scroll', handleSectionContentScroll);
    });
    
    // Handle window resize to reinitialize if switching between mobile/desktop
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Reinitialize handlers if switching between mobile/desktop
            if (!isMobile()) {
                updateActiveSection();
            }
            setNavMode(isMobile() ? 'section' : 'card');
        }, 250);
    });
}

/**
 * Initializes navigation cards for card mode.
 */
function initNavCards() {
    if (isMobile()) {
        return;
    }

    const summariesBySection = {
        0: 'Short intro and profile summary.',
        1: 'Roles, companies, and achievements.',
        2: 'Schools, degrees, and courses.',
        3: 'Selected projects and highlights.',
        4: 'Contact details and links.'
    };

    navBackdrop = document.createElement('div');
    navBackdrop.className = 'nav-backdrop';

    navCardContainer = document.createElement('div');
    navCardContainer.className = 'nav-card-container';

    navButtons.forEach((button, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'nav-card-item';
        card.dataset.section = button.dataset.section || index.toString();
        card.setAttribute('aria-label', button.getAttribute('aria-label') || button.textContent);

        const title = document.createElement('span');
        title.className = 'nav-card-title';
        title.textContent = button.textContent;

        const summary = document.createElement('span');
        summary.className = 'nav-card-summary';
        summary.textContent = summariesBySection[index] || '';

        card.appendChild(title);
        card.appendChild(summary);

        card.addEventListener('mouseenter', () => {
            card.classList.add('is-hovered');
        });
        card.addEventListener('mouseleave', () => {
            card.classList.remove('is-hovered');
        });
        card.addEventListener('click', () => {
            if (isNavigating) {
                return;
            }
            const targetSectionIndex = parseInt(card.dataset.section, 10) || index;
            navigationSource = 'nav';
            if (navMode === 'card') {
                enterSectionMode(targetSectionIndex);
                return;
            }
            scrollToSection(targetSectionIndex);
        });

        navCardContainer.appendChild(card);
        navCardItems.push(card);
    });

    const container = document.querySelector('.cv-container');
    if (container) {
        container.appendChild(navBackdrop);
        container.appendChild(navCardContainer);
        navBackdrop.classList.toggle('is-visible', navMode === 'card');
    }
    
    updateActiveSection();
}

/**
 * Initializes the navigation mode state.
 */
function initNavMode() {
    if (isMobile()) {
        setNavMode('section');
        return;
    }
    setNavMode('card');
}

// ============================================
// Language System (TR/EN)
// ============================================

/**
 * Gets the current language preference from localStorage
 * Turkish is always default on first visit; browser detection is disabled
 * @returns {string} Language code ('tr' or 'en')
 */
function getLanguagePreference() {
    const savedLang = localStorage.getItem('lang');
    if (savedLang === 'tr' || savedLang === 'en') {
        return savedLang;
    }
    return 'tr'; // Default on first visit
}

/**
 * Saves language preference to localStorage
 * @param {string} lang - Language code ('tr' or 'en')
 */
function saveLanguagePreference(lang) {
    localStorage.setItem('lang', lang);
}

/**
 * Switches the displayed language
 * @param {string} lang - Language code ('tr' or 'en')
 */
function switchLanguage(lang) {
    console.log('[LANG SWITCH ENTRY]', { lang, langButtonsCount: langButtons.length, buttons: Array.from(langButtons).map(b => ({ dataLang: b.dataset.lang, innerText: b.innerText, display: b.style.display })) });
    
    // Save preference (overrides auto-detection)
    saveLanguagePreference(lang);
    
    // Update language switcher: show only the OTHER language (click to switch to it)
    langButtons.forEach(button => {
        const beforeText = button.innerText;
        const beforeDisplay = button.style.display;
        if (button.dataset.lang === lang) {
            button.style.display = 'none'; // Hide current language
        } else {
            button.style.display = '';
            button.classList.add('active'); // Show other language as the switch button
        }
        console.log('[LANG SWITCH BUTTON]', { dataLang: button.dataset.lang, beforeText, afterText: button.innerText, beforeDisplay, afterDisplay: button.style.display });
    });
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
    // Update page title
    document.title = lang === 'tr' ? 'Kişisel CV' : 'Personal CV';
    
    // Show/hide content blocks based on language (exclude lang buttons - they use dedicated logic above)
    const allLangBlocks = document.querySelectorAll('[data-lang]');
    const langButtonElements = Array.from(allLangBlocks).filter(b => b.classList && b.classList.contains('lang-button'));
    console.log('[LANG BLOCKS BEFORE]', { lang, allLangBlocksCount: allLangBlocks.length, langButtonElementsCount: langButtonElements.length, langButtonStates: langButtonElements.map(b => ({ dataLang: b.dataset.lang, innerText: b.innerText, display: b.style.display })) });
    allLangBlocks.forEach(block => {
        if (block.classList && block.classList.contains('lang-button')) return; // Skip language switcher buttons
        if (block.dataset.lang === lang) {
            block.style.display = '';
        } else {
            block.style.display = 'none';
        }
    });
    console.log('[LANG BLOCKS AFTER]', { lang, langButtonStates: langButtonElements.map(b => ({ dataLang: b.dataset.lang, innerText: b.innerText, display: b.style.display })) });
    
    // Update navigation button text
    navButtons.forEach(button => {
        const trText = button.dataset.langTr;
        const enText = button.dataset.langEn;
        if (trText && enText) {
            button.textContent = lang === 'tr' ? trText : enText;
        }
    });

    if (navCardItems.length) {
        navCardItems.forEach((card, index) => {
            const sourceButton = navButtons[index];
            if (!sourceButton) return;
            const title = card.querySelector('.nav-card-title');
            if (title) {
                title.textContent = sourceButton.textContent;
            }
        });
    }
    
    // Update headings with data-lang attributes
    const headings = document.querySelectorAll('h1[data-lang-tr], h2[data-lang-tr]');
    headings.forEach(heading => {
        const trText = heading.dataset.langTr;
        const enText = heading.dataset.langEn;
        if (trText && enText) {
            heading.textContent = lang === 'tr' ? trText : enText;
        }
    });
    
    // Update links with data-lang attributes
    const links = document.querySelectorAll('a[data-lang-tr]');
    links.forEach(link => {
        const trText = link.dataset.langTr;
        const enText = link.dataset.langEn;
        if (trText && enText) {
            link.textContent = lang === 'tr' ? trText : enText;
        }
    });
    
    console.log('[LANG SWITCH EXIT]', { lang, finalButtonStates: Array.from(langButtons).map(b => ({ dataLang: b.dataset.lang, innerText: b.innerText, display: b.style.display })) });
}

/**
 * Initializes language system
 */
function initLanguageSystem() {
    console.log('[LANG INIT]', { langButtonsCount: langButtons.length, buttons: Array.from(langButtons).map((b, i) => ({ index: i, dataLang: b.dataset.lang, innerText: b.innerText, className: b.className })) });
    
    // Get language preference (saved or detected)
    const currentLang = getLanguagePreference();
    console.log('[LANG INIT RESTORE]', { currentLang, fromLocalStorage: localStorage.getItem('lang') });
    
    // Set initial language
    switchLanguage(currentLang);
    
    // Add click handlers to language switcher buttons
    langButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('[LANG BUTTON CLICK]', { clickedLang: button.dataset.lang, buttonInnerText: button.innerText });
            const lang = button.dataset.lang;
            if (lang === 'tr' || lang === 'en') {
                switchLanguage(lang);
            }
        });
    });
}

// ============================================
// Section DOM Verification (debug)
// ============================================

function verifySections() {
    const cvSections = document.querySelectorAll('.cv-section');
    const expectedIds = ['about', 'experience', 'education', 'skills', 'projects', 'contact'];
    const viewportW = window.innerWidth;
    const expectedScrollWidth = 6 * viewportW;
    const contentStats = Array.from(sectionContents).map((el, index) => {
        const scrollHeight = el.scrollHeight;
        const clientHeight = el.clientHeight;
        const delta = scrollHeight - clientHeight;
        const canScroll = scrollHeight > clientHeight + 2;
        return { index, scrollHeight, clientHeight, delta, canScroll };
    });
    const overflowCount = contentStats.filter(s => s.canScroll).length;
    
    console.log('[SECTION CHECK]', {
        totalSections: cvSections.length,
        expectedCount: 6,
        sectionsWrapperScrollWidth: sectionsWrapper?.scrollWidth,
        windowInnerWidth: viewportW,
        expectedScrollWidth,
        scrollWidthMatch: sectionsWrapper?.scrollWidth === expectedScrollWidth
    });
    
    cvSections.forEach((section, index) => {
        const parent = section.parentElement;
        const isDirectChildOfWrapper = parent?.classList?.contains('sections-wrapper');
        const expectedId = expectedIds[index];
        const idMatch = section.id === expectedId;
        
        console.log('[SECTION CHECK]', {
            index,
            id: section.id,
            expectedId,
            idMatch,
            className: section.className,
            parentClassName: parent?.className ?? 'null',
            isDirectChildOfWrapper,
            offsetLeft: section.offsetLeft,
            expectedOffsetLeft: index * viewportW
        });
        
        if (!idMatch) console.warn('[SECTION CHECK] Section missing or wrong order:', { index, expectedId, foundId: section.id });
        if (!isDirectChildOfWrapper) console.warn('[SECTION CHECK] Section outside .sections-wrapper:', { index, id: section.id });
    });
    
    if (cvSections.length !== 6) console.warn('[SECTION CHECK] Wrong section count:', cvSections.length, 'expected 6');
    const offsetDeltas = [];
    for (let i = 1; i < cvSections.length; i++) {
        offsetDeltas.push(cvSections[i].offsetLeft - cvSections[i - 1].offsetLeft);
    }
    if (offsetDeltas.some(d => Math.abs(d - viewportW) > 50)) {
        console.warn('[SECTION CHECK] offsetLeft not increasing by ~100vw:', offsetDeltas);
    }
}

// ============================================
// Initialize Everything
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        verifySections();
        initLanguageSystem();
        initNavMode();
        initNavCards();
        initScrollHandlers();
    });
} else {
    verifySections();
    initLanguageSystem();
    initNavMode();
    initNavCards();
    initScrollHandlers();
}
