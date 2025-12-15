'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    //min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    //km/hr
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnDeleteAll = document.querySelector('.btn--delete-all'); // 👈 ADD THIS LINE
const sortInput = document.querySelector('.sort-input');
const messageOverlay = document.querySelector('.message-overlay');
const messageModal = document.querySelector('.message-modal');
const messageIcon = document.querySelector('.message-icon');
const messageText = document.querySelector('.message-text');
const messageCloseBtn = document.querySelector('.message-close-btn');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #workoutToEdit = null; // 👈 Add this property
  #markers = []; // 👈 ADD THIS ARRAY TO TRACK MARKERS

  constructor() {
    this._getPosition();
    this._getLocalStorage();
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    if (btnDeleteAll)
      btnDeleteAll.addEventListener('click', this.reset.bind(this));

    if (sortInput)
      sortInput.addEventListener('change', this._sortWorkouts.bind(this));

    this._closeMessage = this._closeMessage.bind(this); // Bind once for consistency
    messageCloseBtn.addEventListener('click', this._closeMessage);
    messageOverlay.addEventListener('click', this._closeMessage);
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
        this._showMessage(
          'error',
          'GPS location not available. Could not get your position.'
        );
      });
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(latitude, longitude);

    const coords = [latitude, longitude];

    console.log(this);
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    //Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // this.#workouts.forEach(work => {
    //   const restoredWorkouts =
    //     work.type === 'running'
    //       ? new Running(work.coords, work.distance, work.duration, work.cadence)
    //       : new Cycling(
    //           work.coords,
    //           work.distance,
    //           work.duration,
    //           work.elevationGain
    //         );

    //   restoredWorkouts.id = work.id;

    //   console.log(restoredWorkouts);

    //   this._renderWorkoutMarker(restoredWorkouts);
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _deleteWorkout(id) {
    const workoutToDelete = this.#workouts.find(workout => workout.id === id);

    const confirmed = confirm(
      `Are you sure you want to delete "${workoutToDelete.description}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    // FIND AND REMOVE MARKER (NEW LOGIC)
    const markerIndex = this.#markers.findIndex(m => m.id === id);
    if (markerIndex !== -1) {
      this.#map.removeLayer(this.#markers[markerIndex].marker); // Remove from map
      this.#markers.splice(markerIndex, 1); // Remove from tracking array
    }

    // 1. Find the workout in the array and remove it
    this.#workouts = this.#workouts.filter(workout => workout.id !== id);

    // 2. Update Local Storage
    this._setLocalStorage();

    // 3. Re-render the UI elements (list)
    this._refreshWorkoutsUI();
    this._showMessage(
      'success',
      `Workout "${workoutToDelete.description}" was successfully deleted.`
    );
  }

  _updateWorkout(e) {
    e.preventDefault();

    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    const workout = this.#workoutToEdit;

    // 1. Get common form data
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    // Check if the workout type was changed (which is not allowed in this simple implementation)
    // For this exercise, we assume the type is NOT changed during edit.
    if (type !== workout.type) {
      return this._showMessage(
        'error',
        'Cannot change workout type during edit. Please delete and create a new workout instead.'
      );
    }

    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._showMessage(
          'error',
          'Input must be a positive number for Distance, Duration, and Cadence.'
        );

      // Update properties on the existing object
      workout.distance = distance;
      workout.duration = duration;
      workout.cadence = cadence;
      workout.calcPace(); // Recalculate pace
    } else if (type === 'cycling') {
      const elevation = +inputElevation.value;

      // Note: Only distance and duration must be positive for cycling, elevation can be 0 or negative
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._showMessage(
          'error',
          'Input must be a positive number for Distance and Duration in Cycling.'
        );

      // Update properties on the existing object
      workout.distance = distance;
      workout.duration = duration;
      workout.elevationGain = elevation;
      workout.calcSpeed(); // Recalculate speed
    }

    // 2. Hide form and reset state
    this._hideForm();
    this.#workoutToEdit = null;

    // Reset the form submission listener back to _newWorkout
    form.removeEventListener('submit', this._updateWorkout.bind(this));
    form.addEventListener('submit', this._newWorkout.bind(this));

    // 3. Re-render the workouts list (best way is to re-render all for simplicity)
    this._refreshWorkoutsUI();

    // 4. Update Local Storage
    this._setLocalStorage();

    // NEW Success Message
    this._showMessage(
      'success',
      `${workout.description} successfully updated!`
    );
  }

  _sortWorkouts(e) {
    const sortValue = e.target.value;

    if (sortValue === 'distance-asc') {
      // Sort by distance (Closest/Ascending)
      this.#workouts.sort((a, b) => a.distance - b.distance);
    } else if (sortValue === 'distance-desc') {
      // Sort by distance (Farthest/Descending)
      this.#workouts.sort((a, b) => b.distance - a.distance);
    } else if (sortValue === 'duration-desc') {
      // Sort by duration (Longest/Descending)
      this.#workouts.sort((a, b) => b.duration - a.duration);
    } else {
      // Default: 'date-desc' (Newest first).
      // The ID is based on Date.now(), so we can use it for date sorting.
      this.#workouts.sort((a, b) => b.id - a.id);
    }

    // Re-render the UI based on the new, sorted order
    this._refreshWorkoutsUI();
  }

  _refreshWorkoutsUI() {
    // 1. Clear the current list of workouts
    const existingWorkoutsHTML = containerWorkouts.querySelectorAll('.workout');
    existingWorkoutsHTML.forEach(el => el.remove());

    // 2. Clear all existing markers from the map
    this._clearMarkers(); // 👈 CALL THE NEW METHOD

    // 3. Re-render all workouts with the updated data
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
      this._renderWorkoutMarker(work); // 👈 Re-render markers in sorted/updated list order
    });

    // We don't need to save to Local Storage here, as the methods calling this (sort/delete) handle that.
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _showEditForm(workout) {
    this.#workoutToEdit = workout;

    // Set form to visible
    form.classList.remove('hidden');

    // Populate form fields with current workout data
    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    // Toggle elevation/cadence fields based on type and populate specific fields
    if (workout.type === 'running') {
      // Ensure running fields are visible, cycling are hidden
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputCadence.value = workout.cadence;
    } else if (workout.type === 'cycling') {
      // Ensure cycling fields are visible, running are hidden
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.value = workout.elevationGain;
    }

    // Change the form submission listener to the update method
    form.removeEventListener('submit', this._newWorkout.bind(this));
    form.addEventListener('submit', this._updateWorkout.bind(this));

    // Optionally change the button text to 'Update' if you have a visible button
    // The current form__btn is display: none, so this isn't strictly necessary.
    // However, if you add a visible button, you would update it here.

    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    if (!this.#mapEvent)
      return this._showMessage(
        'error',
        'Please click on the map to place your workout first!'
      );
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    e.preventDefault();

    // 1. Get common form data
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._showMessage(
          'error',
          'Input must be a positive number for Distance, Duration, and Cadence.'
        );

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._showMessage(
          'error',
          'Input must be a positive number for Distance and Duration in Cycling.'
        );

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);

    this._renderWorkoutMarker(workout);

    this._renderWorkout(workout);
    //Clear input fields

    this._hideForm();

    this._setLocalStorage();

    // NEW Success Message
    this._showMessage('success', `${workout.description} successfully added!`);

    this.#mapEvent = null;
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
    this.#markers.push({ id: workout.id, marker: marker }); // 👈 STORE THE MARKER
  }

  _clearMarkers() {
    this.#markers.forEach(markerObj => {
      this.#map.removeLayer(markerObj.marker);
    });
    this.#markers = [];
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️ ' : '🚴‍♀️ '
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
          <div class="workout__row workout__row--actions">
            <button class="btn--edit" data-id="${workout.id}">✏️ Edit</button>
            <button class="btn--delete" data-id="${
              workout.id
            }">🗑 Delete</button>
        </div>
        </li>
    `;

    if (workout.type === 'cycling')
      html += `
        
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
          <div class="workout__row workout__row--actions">
            <button class="btn--edit" data-id="${workout.id}">✏️ Edit</button>
            <button class="btn--delete" data-id="${
              workout.id
            }">🗑 Delete</button>
        </div>
        </li>
    `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const target = e.target;

    // 1. Handle Delete/Edit button clicks first
    if (target.classList.contains('btn--delete')) {
      const workoutId = target.dataset.id;
      return this._deleteWorkout(workoutId);
    }

    // 👈 Handle Edit button click
    if (target.classList.contains('btn--edit')) {
      const workoutId = target.dataset.id;
      const workout = this.#workouts.find(work => work.id === workoutId);
      return this._showEditForm(workout);
    }

    // 2. Original logic (if not a button, move to map location)
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    // We must restore the objects as class instances (Running or Cycling)
    // so they have access to their prototype methods (like calcPace/calcSpeed).
    const restoredWorkouts = data.map(work => {
      const restored =
        work.type === 'running'
          ? new Running(work.coords, work.distance, work.duration, work.cadence)
          : new Cycling(
              work.coords,
              work.distance,
              work.duration,
              work.elevationGain
            );
      // Preserve the original unique ID
      restored.id = work.id;
      // Also restore the original date object (since JSON.parse makes it a string)
      restored.date = new Date(work.date);
      restored.clicks = work.clicks;
      return restored;
    });

    this.#workouts = restoredWorkouts;

    // Render the list items
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    const confirmed = confirm(
      'Are you sure you want to clear ALL workouts? This action cannot be undone.'
    );

    if (!confirmed) return; // 👈 Add this check: Prevent deletion if user clicks Cancel.

    localStorage.removeItem('workouts');
    location.reload();
  }

  // script.js (Inside App class)

  _closeMessage() {
    messageOverlay.classList.add('hidden');
    messageModal.classList.remove('error', 'success');
  }

  _showMessage(type, message) {
    messageOverlay.classList.remove('hidden');
    messageText.textContent = message;

    messageModal.classList.remove('error', 'success');
    if (type === 'error') {
      messageModal.classList.add('error');
      messageIcon.textContent = '❌'; // Error icon
    } else if (type === 'success') {
      messageModal.classList.add('success');
      messageIcon.textContent = '✅'; // Success icon
    } else {
      messageIcon.textContent = 'ℹ️'; // Info icon (default)
    }
  }
}

const app = new App();
