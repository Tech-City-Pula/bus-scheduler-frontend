// importing date-fns library for date manipulation
import * as dateFns from 'https://cdn.jsdelivr.net/npm/date-fns@2.23.0/esm/index.js';

// our API base url (entry point to API) goes here
const API_BASE_URL = 'https://bus-scheduler-backend-production.up.railway.app';

// state used for keeping the driver and selected time
let currentDriverId = undefined;
let currentDateTime = new Date();

// elements needed for site functionality
const table = document.getElementById('table');
const loadingIndicator = document.getElementById('loading-indicator');
const selectedWeekContainer = document.getElementById('selected-week');
const tripsContainer = document.getElementById('trips');
const driverDropdown = document.getElementById('driver-schedule-dropdown');
const previousButton = document.getElementById('previous-button');
const nextButton = document.getElementById('next-button');
const floatingActionButton = document.getElementById('fab');
const tripForm = document.getElementById('trip-form');
const driverFormDropdown = document.getElementById('driver-form-select');
const departureFormDropdown = document.getElementById('departure-form-select');
const destinationFormDropdown = document.getElementById(
	'destination-form-select'
);
const tripFormCancelButton = document.getElementById('trip-form-cancel-button');

// function for creating a trip card
function createTripElement({
	hour,
	weekDay,
	duration,
	totalDuration,
	departure,
	destination,
	date,
}) {
	hour += 1; // add 1 to hour because grid rows/columns start at 1

	// create html for trip card, using inline styles for placement inside the grid
	const tripHtml = `
    <div class="trip" style="grid-row: ${hour} / span ${duration}; grid-column: ${weekDay} / span 1;">
        <div class="trip-title">
            <div>${dateFns.format(date, 'dd.MM.yyyy.')}</div>
            <div>${totalDuration}h</div>
        </div>
        <div class="trip-locations">
            <div>${departure} -&gt; ${destination}</div>
        </div>
    </div>
    `;

	return tripHtml;
}

// function for showing the loading indicator
function showLoading() {
	loadingIndicator.classList.remove('hidden');
}

// function for hiding the loading indicator
function hideLoading() {
	loadingIndicator.classList.add('hidden');
}

// function for unlocking buttons after loading schedule is done
function unlockButtons() {
	previousButton.disabled = false;
	nextButton.disabled = false;
}

// function for getting drivers and creating option elements for the select dropdown
async function getDrivers() {
	showLoading();

	const response = await fetch(API_BASE_URL + '/drivers');

	const json = await response.json();

	json.drivers.forEach((driver) => {
		const option = document.createElement('option');
		option.value = driver.id;
		option.textContent = driver.name;

		driverDropdown.appendChild(option);
		driverFormDropdown.appendChild(option.cloneNode(true));
	});

	hideLoading();
}

// function for getting the schedule of a driver for a certain week
async function getSchedule(driverId, date) {
	showLoading();

	date = dateFns.startOfWeek(date, { weekStartsOn: 1 }); // turn into monday
	date = date.toISOString(); // turn monday into ISO string

	const response = await fetch(
		API_BASE_URL + `/schedule?driverId=${driverId}&date=${date}`
	);

	const json = await response.json();

	const groupedByWeekdays = json.trips.reduce((allTrips, trip) => {
		const tripStartTime = new Date(trip.departure_time);
		let weekDay = tripStartTime.getDay();

		// if it's sunday, set it to 7
		weekDay = weekDay === 0 ? 7 : weekDay;

		// if there are no trips for that day, create an empty array
		if (!allTrips[weekDay]) {
			allTrips[weekDay] = [];
		}

		// calculate the end time of the trip
		const tripEndTime = dateFns.addHours(tripStartTime, trip.duration);
		let tripEndWeekday = tripEndTime.getDay();

		// if it's sunday, set it to 7
		tripEndWeekday = tripEndWeekday === 0 ? 7 : tripEndWeekday;

		// if trip duration overflows into the next day, add it to the next day as well
		if (tripEndWeekday !== weekDay) {
			// if there are no trips for that day, create an empty array
			if (!allTrips[tripEndWeekday]) {
				allTrips[tripEndWeekday] = [];
			}

			const duration = dateFns.getHours(tripEndTime); // calculate leftover duration for card size
			const hour = 0; // set hour to midnight for card beginning

			// if duration is 0 after calculation, skip creating trip
			if (duration !== hour) {
				allTrips[tripEndWeekday].push({
					hour,
					weekDay: tripEndWeekday,
					duration,
					totalDuration: trip.duration,
					departure: trip.departure.name,
					destination: trip.destination.name,
					date: tripEndTime,
				});
			}
		}

		// add trip to the day it belongs to
		allTrips[weekDay].push({
			hour: dateFns.getHours(tripStartTime),
			weekDay,
			duration: trip.duration,
			totalDuration: trip.duration,
			departure: trip.departure.name,
			destination: trip.destination.name,
			date: tripStartTime,
		});

		return allTrips;
	}, []);

	// first clear the trips container
	tripsContainer.innerHTML = '';

	// add new trips to the container
	groupedByWeekdays.forEach((trips) => {
		// is null if there are no trips for that day
		if (trips?.length > 0) {
			trips.forEach((trip) => {
				const tripHtml = createTripElement(trip);

				tripsContainer.innerHTML += tripHtml;
			});
		}
	});

	// show the table after loading is done
	table.classList.remove('hidden');

	hideLoading();
	unlockButtons();
}

// function for creating and updating our selected week value in the header
function createWeekdayHeader(date) {
	const currentMonday = dateFns.startOfWeek(date, {
		weekStartsOn: 1,
	});
	const currentSunday = dateFns.endOfWeek(date, { weekStartsOn: 1 });
	const formattedStartDate = dateFns.format(currentMonday, 'dd.MM.yyyy');
	const formattedEndDate = dateFns.format(currentSunday, 'dd.MM.yyyy');

	selectedWeekContainer.textContent = `${formattedStartDate} - ${formattedEndDate}`;
}

// function for getting all the cities and creating option elements for the select dropdown
async function getCities() {
	const response = await fetch(API_BASE_URL + '/cities');

	const json = await response.json();

	json.cities.forEach((city) => {
		const option = document.createElement('option');
		option.value = city.id;
		option.textContent = city.name;

		departureFormDropdown.appendChild(option);
		destinationFormDropdown.appendChild(option.cloneNode(true));
	});
}

// function for creating a new trip
async function createNewTrip({
	driverId,
	departureId,
	destinationId,
	date,
	duration,
}) {
	// construct the request body
	const requestBody = {
		driverId: driverId,
		departure: departureId,
		destination: destinationId,
		date: date,
		duration: duration,
	};

	await fetch(API_BASE_URL + '/trip', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requestBody), // javascript object needs to turned into json (JavaScript Object Notation) string
	});

	await getSchedule(currentDriverId, currentDateTime);
}

// when the page is loaded get all the bus drivers and cities for the dropdowns
document.addEventListener('DOMContentLoaded', () => {
	getDrivers();
	getCities();
	createWeekdayHeader(currentDateTime);
});

// on dropdown select, change the bus driver and set his schedule to current week
driverDropdown.addEventListener('input', (event) => {
	const selectedDriverId = event.target.value;

	currentDriverId = selectedDriverId;

	getSchedule(selectedDriverId, currentDateTime);
});

// get previous weeks schedule for selected driver
previousButton.addEventListener('click', () => {
	currentDateTime = dateFns.addWeeks(currentDateTime, -1);

	createWeekdayHeader(currentDateTime);

	getSchedule(currentDriverId, currentDateTime);
});

// get next weeks schedule for selected driver
nextButton.addEventListener('click', () => {
	currentDateTime = dateFns.addWeeks(currentDateTime, 1);

	createWeekdayHeader(currentDateTime);

	getSchedule(currentDriverId, currentDateTime);
});

// toggle trip form on button click
floatingActionButton.addEventListener('click', () => {
	tripForm.classList.toggle('show-form');
});

// create new trip on form submit
tripForm.addEventListener('submit', async (event) => {
	event.preventDefault(); // prevent default form submit behaviour
	const form = event.target; // extract form element from event
	const formData = new FormData(form); // create form data from form element

	// get all the values from the form
	const driverId = formData.get('driver-form-select');
	const destinationId = formData.get('destination-form-select');
	const departureId = formData.get('departure-form-select');
	const duration = formData.get('duration-form-select');
	let date = formData.get('datetime-form-select');

	// set minutes, seconds and milliseconds to 0
	date = new Date(date);
	date = dateFns.setMinutes(date, 0);
	date = dateFns.setSeconds(date, 0);
	date = dateFns.setMilliseconds(date, 0);

	showLoading();

	// make network request to create new trip
	await createNewTrip({
		driverId: Number(driverId),
		date: date,
		departureId: Number(departureId),
		destinationId: Number(destinationId),
		duration: Number(duration),
	});

	hideLoading();

	form.reset();

	tripForm.classList.toggle('show-form');
});

// clear form and hide trip form on cancel button click
tripFormCancelButton.addEventListener('click', () => {
	form.reset();

	tripForm.classList.toggle('show-form');
});
