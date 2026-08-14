const eventsDataUrl = 'assets/upcoming/events.json';

const loadEvents = async () => {
  const response = await fetch(eventsDataUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load events');
  return response.json();
};
const loadEventPosters = async () => {
  const response = await fetch(`assets/upcoming/manifest.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load event posters');
  const posters = await response.json();
  return Array.isArray(posters) ? posters : [];
};

const eventUrl = (event) => `event-details.html?id=${encodeURIComponent(event.id)}`;
const escapeText = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const christianObservanceIds = new Set(['palm-sunday-2026', 'maundy-thursday-2026', 'good-friday-2026', 'holy-saturday-2026', 'easter-sunday-2026', 'ascension-day-2026', 'pentecost-sunday-2026', 'advent-sunday-2026', 'christmas-eve-2026', 'christmas-day-2026']);
const usHolidayIds = new Set(['new-years-day-2026', 'mlk-day-2026', 'presidents-day-2026', 'memorial-day-2026', 'juneteenth-2026', 'independence-day-2026', 'labor-day-2026', 'columbus-day-2026', 'veterans-day-2026', 'thanksgiving-day-2026']);
const eventCategory = (event) => christianObservanceIds.has(event.id) ? 'christian' : usHolidayIds.has(event.id) ? 'holiday' : 'church';

const eventsForDate = (events, date) => {
  const day = date.getDate();
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const matches = events.filter((event) => event.date === dateKey);
  const recurrence = (name) => events.find((event) => event.recurrence === name);
  if (date.getDay() === 0) {
    const sundayNumber = Math.ceil(day / 7);
    const sundayEvent = sundayNumber === 1 ? recurrence('first-sunday') : sundayNumber === 3 ? recurrence('third-sunday') : recurrence('weekly-sunday');
    if (sundayEvent) matches.unshift(sundayEvent);
  }
  if (date.getDay() === 6 && day <= 7 && recurrence('first-saturday')) matches.unshift(recurrence('first-saturday'));
  if (date.getDay() === 4 && [1, 3].includes(Math.ceil(day / 7)) && recurrence('first-third-thursday')) matches.unshift(recurrence('first-third-thursday'));
  if (date.getDay() === 5 && recurrence('weekly-friday')) matches.unshift(recurrence('weekly-friday'));
  if (day === 1 && recurrence('first-of-month')) matches.unshift(recurrence('first-of-month'));
  return matches;
};

const renderEventAgenda = (events) => {
  const agenda = document.querySelector('[data-event-agenda]');
  if (!agenda) return;
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const occurrences = [];
  for (let offset = 0; offset < 56; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    eventsForDate(events, date).forEach((event) => occurrences.push({ event, date: new Date(date) }));
  }
  const items = occurrences.slice(0, 7).map(({ event, date }) => `<a class="event-agenda-item event-category-${eventCategory(event)}" href="${eventUrl(event)}"><time datetime="${date.toISOString().slice(0, 10)}"><strong>${date.toLocaleDateString('en-US', { day: '2-digit' })}</strong><span>${date.toLocaleDateString('en-US', { month: 'short' })}</span></time><span class="event-agenda-copy"><strong>${escapeText(event.title)}</strong><small>${escapeText(event.time || event.dateLabel)}</small></span><span class="event-agenda-arrow" aria-hidden="true">→</span></a>`).join('');
  agenda.innerHTML = `<div class="event-agenda-track">${items}</div><div class="event-agenda-track" aria-hidden="true">${items}</div>`;
  const toggle = document.querySelector('[data-agenda-toggle]');
  let manuallyPaused = false;
  let autoScroll;
  const stopAutoScroll = () => {
    window.clearInterval(autoScroll);
  };
  const startAutoScroll = () => {
    stopAutoScroll();
    if (manuallyPaused) return;
    autoScroll = window.setInterval(() => {
      agenda.scrollTop += 1;
      const halfway = agenda.scrollHeight / 2;
      if (agenda.scrollTop >= halfway) agenda.scrollTop -= halfway;
    }, 35);
  };
  toggle?.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    agenda.classList.toggle('is-paused', manuallyPaused);
    toggle.textContent = manuallyPaused ? 'Play' : 'Pause';
    toggle.setAttribute('aria-pressed', String(manuallyPaused));
    toggle.setAttribute('aria-label', `${manuallyPaused ? 'Resume' : 'Pause'} automatic event scrolling`);
    if (manuallyPaused) stopAutoScroll(); else startAutoScroll();
  });
  document.querySelector('.event-agenda-side-controls')?.addEventListener('click', (event) => {
    const direction = event.target.closest('[data-agenda-scroll]')?.dataset.agendaScroll;
    if (!direction) return;
    manuallyPaused = true;
    agenda.classList.add('is-paused');
    stopAutoScroll();
    toggle.textContent = 'Play';
    toggle.setAttribute('aria-pressed', 'true');
    toggle.setAttribute('aria-label', 'Resume automatic event scrolling');
    agenda.scrollBy({ top: direction === 'down' ? 56 : -56, behavior: 'smooth' });
  });
  agenda.addEventListener('mouseenter', stopAutoScroll);
  agenda.addEventListener('mouseleave', startAutoScroll);
  agenda.addEventListener('focusin', stopAutoScroll);
  agenda.addEventListener('focusout', startAutoScroll);
  startAutoScroll();
};

const renderEventCards = (events, posters) => {
  const list = document.querySelector('[data-event-list]');
  if (!list) return;
  const visibleEvents = events.filter((event) => !event.calendarOnly);
  const normalizePath = (path = '') => decodeURIComponent(path).replace(/\\/g, '/').toLowerCase();
  const eventByImage = new Map(visibleEvents.map((event) => [normalizePath(event.image), event]));
  const posterCards = posters.map((image) => {
    const event = eventByImage.get(normalizePath(image));
    if (event) return { ...event, href: eventUrl(event), external: false };
    return {
      title: 'Church Announcement',
      dateLabel: 'View the poster for complete details',
      image,
      summary: 'A newly published update from Denver Tamil Church.',
      href: image,
      external: true
    };
  });
  list.innerHTML = posterCards.map((event, index) => `<article class="event-poster-card" data-event-slide="${index}"><a href="${escapeText(event.href)}"${event.external ? ' target="_blank" rel="noopener noreferrer"' : ''}><figure><img src="${escapeText(event.image)}" alt="${escapeText(event.title)} poster" width="1672" height="941" loading="lazy" /><span class="event-poster-image-label">${event.external ? 'New update' : 'Featured event'}</span></figure><div class="event-poster-content"><span class="event-poster-kicker">Upcoming event</span><h3>${escapeText(event.title)}</h3><dl class="event-poster-meta"><div><dt>Details</dt><dd>${escapeText(event.dateLabel)}</dd></div>${event.location ? `<div><dt>Location</dt><dd>${escapeText(event.location)}</dd></div>` : ''}</dl><p>${escapeText(event.summary)}</p><strong>${event.external ? 'View full poster' : 'Explore event'} <span aria-hidden="true">→</span></strong></div></a></article>`).join('');
  list.tabIndex = 0;
  list.setAttribute('role', 'region');
  list.setAttribute('aria-label', 'Scrollable event posters');
  list.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    list.scrollBy({ left: list.clientWidth * (event.key === 'ArrowRight' ? 1 : -1), behavior: 'smooth' });
  });
  list.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const canMove = event.deltaY > 0
      ? list.scrollLeft + list.clientWidth < list.scrollWidth - 2
      : list.scrollLeft > 2;
    if (!canMove) return;
    event.preventDefault();
    list.scrollBy({ left: event.deltaY, behavior: 'auto' });
  }, { passive: false });
  if (posterCards.length > 1) {
    const carouselColumn = list.closest('.event-carousel-column');
    const controls = document.createElement('div');
    controls.className = 'event-poster-controls';
    controls.innerHTML = `<span class="event-slide-count" aria-live="polite"><strong data-event-current>01</strong><span>/</span>${String(posterCards.length).padStart(2, '0')}</span><div class="event-poster-buttons"><button type="button" data-event-scroll="previous" aria-label="Show previous event poster"><span aria-hidden="true">←</span></button><button type="button" data-event-scroll="next" aria-label="Show next event poster"><span aria-hidden="true">→</span></button></div>`;
    carouselColumn?.append(controls);
    const currentSlide = controls.querySelector('[data-event-current]');
    const updateSlide = () => {
      const index = Math.min(posterCards.length - 1, Math.max(0, Math.round(list.scrollLeft / Math.max(list.clientWidth, 1))));
      currentSlide.textContent = String(index + 1).padStart(2, '0');
      list.closest('.event-list-section')?.style.setProperty('--event-progress', `${((index + 1) / posterCards.length) * 100}%`);
    };
    let scrollFrame;
    list.addEventListener('scroll', () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(updateSlide);
    }, { passive: true });
    updateSlide();
    controls.addEventListener('click', (event) => {
      const direction = event.target.closest('[data-event-scroll]')?.dataset.eventScroll;
      if (!direction) return;
      const distance = list.clientWidth * (direction === 'next' ? 1 : -1);
      list.scrollBy({ left: distance, behavior: 'smooth' });
    });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let rotation;
      const advance = () => {
        const reachedEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 12;
        if (reachedEnd) list.scrollTo({ left: 0, behavior: 'smooth' });
        else list.scrollBy({ left: list.clientWidth, behavior: 'smooth' });
      };
      const startRotation = () => {
        window.clearInterval(rotation);
        rotation = window.setInterval(advance, 5200);
      };
      const stopRotation = () => window.clearInterval(rotation);
      list.addEventListener('mouseenter', stopRotation);
      list.addEventListener('mouseleave', startRotation);
      list.addEventListener('pointerdown', stopRotation);
      list.addEventListener('pointerup', startRotation);
      list.addEventListener('focusin', stopRotation);
      list.addEventListener('focusout', startRotation);
      document.addEventListener('visibilitychange', () => document.hidden ? stopRotation() : startRotation());
      startRotation();
    }
  }
};

const renderCalendar = (events) => {
  const calendar = document.querySelector('.event-calendar');
  const monthLabel = document.querySelector('[data-calendar-month]');
  if (!calendar || !monthLabel) return;
  const now = new Date();
  let visibleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const datedEvents = events.filter((event) => event.date);
  if (!datedEvents.some((event) => event.date.startsWith(`${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`))) {
    const nextEvent = datedEvents.map((event) => event.date).sort().find((date) => new Date(`${date}T12:00:00`) >= now);
    if (nextEvent) { const date = new Date(`${nextEvent}T12:00:00`); visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1); }
  }
  const render = () => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    monthLabel.textContent = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const headings = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<div class="event-calendar-weekday">${day}</div>`).join('');
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let cells = Array.from({ length: firstWeekday }, () => '<div class="event-calendar-day is-empty" aria-hidden="true"></div>').join('');
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day);
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = eventsForDate(events, date);
      cells += `<div class="event-calendar-day${dateKey === todayKey ? ' is-today' : ''}"><span class="event-calendar-date">${day}</span>${dayEvents.map((event) => `<a class="event-category-${eventCategory(event)}" href="${eventUrl(event)}" aria-label="${escapeText(event.title)} — ${eventCategory(event) === 'christian' ? 'Christian observance' : eventCategory(event) === 'holiday' ? 'U.S. holiday' : 'Church event'}">${escapeText(event.title)}${event.time ? `<small>${escapeText(event.time)}</small>` : ''}</a>`).join('')}</div>`;
    }
    calendar.innerHTML = headings + cells;
  };
  document.querySelector('[data-calendar-previous]')?.addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); render(); });
  document.querySelector('[data-calendar-next]')?.addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); render(); });
  render();
};

const renderEventDetail = (events) => {
  const container = document.querySelector('[data-event-detail]');
  if (!container) return;
  const id = new URLSearchParams(location.search).get('id');
  const event = events.find((item) => item.id === id);
  if (!event) { container.innerHTML = '<div class="event-not-found"><h1>Event not found</h1><p>Please return to Upcoming Events and choose an event.</p></div>'; return; }
  document.title = `${event.title} | Denver Tamil Church`;
  const directions = event.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : '';
  container.innerHTML = `<div class="event-detail-poster"><a href="${escapeText(event.image)}" target="_blank" rel="noopener noreferrer" aria-label="Open full-size ${escapeText(event.title)} poster"><img src="${escapeText(event.image)}" alt="${escapeText(event.title)} event poster" width="1672" height="941" /></a><span>Select the poster to view it full size</span></div><div class="event-detail-content"><p class="eyebrow">UPCOMING EVENT</p><h1>${escapeText(event.title)}</h1><p class="event-detail-date">${escapeText(event.dateLabel)}</p>${event.location ? `<p class="event-detail-location">${escapeText(event.location)}</p>` : ''}<p>${escapeText(event.summary)}</p><h2>What to Expect</h2><ul>${event.details.map((detail) => `<li>${escapeText(detail)}</li>`).join('')}</ul><div class="event-detail-actions">${directions ? `<a class="btn btn-primary" href="${directions}" target="_blank" rel="noopener noreferrer">Get Directions</a>` : ''}<a class="btn btn-dark" href="contact.html">Ask a Question</a></div></div>`;
};

document.addEventListener('DOMContentLoaded', async () => {
  try { const [events, posters] = await Promise.all([loadEvents(), loadEventPosters()]); renderEventCards(events, posters); renderEventAgenda(events); renderCalendar(events); renderEventDetail(events); }
  catch (error) { document.querySelectorAll('[data-event-list], [data-event-detail]').forEach((node) => { node.innerHTML = '<p>Event information is temporarily unavailable. Please contact the church for assistance.</p>'; }); }
});
