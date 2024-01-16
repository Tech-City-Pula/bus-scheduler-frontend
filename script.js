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
const driverDropdown = document.getElementById('driver-dropdown');
const previousButton = document.getElementById('previous-button');
const nextButton = document.getElementById('next-button');

// function for creating a trip card
function createTrip({
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
				const tripHtml = createTrip(trip);

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

// when the page is loaded get all the bus drivers for the dropdown
document.addEventListener('DOMContentLoaded', () => {
	getDrivers();

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
