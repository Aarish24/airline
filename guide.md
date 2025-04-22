Airline Management System Implementation Plan
Overview
This plan outlines how to create an Airline Management System using Node.js, Express, and PostgreSQL with the same simplicity and structure as the Book Management System.

Database Schema (8 Tables)
airline

id (VARCHAR, PK)
name (VARCHAR)
iata_code (VARCHAR)
country (VARCHAR)
founded_year (INTEGER)
airport

id (VARCHAR, PK)
name (VARCHAR)
iata_code (VARCHAR)
city (VARCHAR)
country (VARCHAR)
latitude (DECIMAL)
longitude (DECIMAL)
aircraft

id (VARCHAR, PK)
registration_number (VARCHAR)
model (VARCHAR)
manufacturer (VARCHAR)
capacity (INTEGER)
year_manufactured (INTEGER)
airline_id (VARCHAR, FK to airline)
flight

id (VARCHAR, PK)
flight_number (VARCHAR)
departure_airport_id (VARCHAR, FK to airport)
arrival_airport_id (VARCHAR, FK to airport)
departure_time (TIMESTAMP)
arrival_time (TIMESTAMP)
aircraft_id (VARCHAR, FK to aircraft)
airline_id (VARCHAR, FK to airline)
status (VARCHAR)
passenger

id (VARCHAR, PK)
first_name (VARCHAR)
last_name (VARCHAR)
email (VARCHAR)
phone (VARCHAR)
passport_number (VARCHAR)
nationality (VARCHAR)
date_of_birth (DATE)
booking

id (VARCHAR, PK)
flight_id (VARCHAR, FK to flight)
passenger_id (VARCHAR, FK to passenger)
booking_date (TIMESTAMP)
seat_number (VARCHAR)
booking_status (VARCHAR)
price (DECIMAL)
crew_member

id (VARCHAR, PK)
first_name (VARCHAR)
last_name (VARCHAR)
position (VARCHAR)
airline_id (VARCHAR, FK to airline)
license_number (VARCHAR)
experience_years (INTEGER)
flight_crew

flight_id (VARCHAR, FK to flight)
crew_member_id (VARCHAR, FK to crew_member)
role (VARCHAR)
PRIMARY KEY (flight_id, crew_member_id)
Project Structure
airline_management_system/
├── db.js                  # Database connection
├── index.js               # Main application file
├── package.json           # Project dependencies
├── public/                # Frontend files
│   └── index.html         # Main HTML interface
├── routes/                # API route handlers
│   ├── airlines.js
│   ├── airports.js
│   ├── aircraft.js
│   ├── flights.js
│   ├── passengers.js
│   ├── bookings.js
│   └── crew-members.js
└── README.md              # Project documentation
Implementation Steps
1. Set Up Project
   Create a new directory for the project:

mkdir airline_management_system
cd airline_management_system
Initialize npm:

npm init -y
Install dependencies:

npm install express pg uuid
2. Database Setup
   Create a PostgreSQL database:

CREATE DATABASE airlinedb;
Connect to the database:

\c airlinedb
Create the database schema (copy from the schema section below)

Insert sample data (copy from the sample data section below)

3. Create Core Files
   db.js - Database connection:

const { Pool } = require('pg');

const pool = new Pool({
host: 'localhost',
user: 'postgres',
password: 'your_password', // Change this to your PostgreSQL password
port: 5432,
database: 'airlinedb',
authentication_timeout: 10000,
connectionTimeoutMillis: 2000,
});

module.exports = pool;
index.js - Main application file:

const express = require('express');
const path = require('path');
const pool = require('./db');

// Import route files
const airlinesRouter = require('./routes/airlines');
const airportsRouter = require('./routes/airports');
const aircraftRouter = require('./routes/aircraft');
const flightsRouter = require('./routes/flights');
const passengersRouter = require('./routes/passengers');
const bookingsRouter = require('./routes/bookings');
const crewMembersRouter = require('./routes/crew-members');

const app = express();
const PORT = 4770;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers
app.use((req, res, next) => {
res.header('Access-Control-Allow-Origin', '*');
res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
if (req.method === 'OPTIONS') {
return res.sendStatus(200);
}
next();
});

// Serve HTML interface
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Use route files
app.use('/airlines', airlinesRouter);
app.use('/airports', airportsRouter);
app.use('/aircraft', aircraftRouter);
app.use('/flights', flightsRouter);
app.use('/passengers', passengersRouter);
app.use('/bookings', bookingsRouter);
app.use('/crew-members', crewMembersRouter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
try {
const result = await pool.query('SELECT NOW()');
res.status(200).json({
status: 'ok',
message: 'Database connection successful',
timestamp: result.rows[0].now
});
} catch (error) {
res.status(500).json({
status: 'error',
message: 'Database connection failed',
error: error.message
});
}
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
try {
// Using a transaction to ensure data consistency
await pool.query('BEGIN');

        // Get counts
        const flightCount = await pool.query('SELECT COUNT(*) FROM flight');
        const passengerCount = await pool.query('SELECT COUNT(*) FROM passenger');
        const airlineCount = await pool.query('SELECT COUNT(*) FROM airline');
        const aircraftCount = await pool.query('SELECT COUNT(*) FROM aircraft');
        const airportCount = await pool.query('SELECT COUNT(*) FROM airport');
        const bookingCount = await pool.query('SELECT COUNT(*) FROM booking');
        const crewMemberCount = await pool.query('SELECT COUNT(*) FROM crew_member');
        
        // Get flights per airline using GROUP BY
        const flightsPerAirline = await pool.query(`
            SELECT a.name, COUNT(f.id) as flight_count
            FROM airline a
            LEFT JOIN flight f ON a.id = f.airline_id
            GROUP BY a.name
            ORDER BY flight_count DESC
        `);
        
        // Get flights per airport using GROUP BY
        const flightsPerAirport = await pool.query(`
            SELECT ap.name, ap.iata_code, 
                   COUNT(f1.id) as departures,
                   COUNT(f2.id) as arrivals,
                   COUNT(f1.id) + COUNT(f2.id) as total_flights
            FROM airport ap
            LEFT JOIN flight f1 ON ap.id = f1.departure_airport_id
            LEFT JOIN flight f2 ON ap.id = f2.arrival_airport_id
            GROUP BY ap.id, ap.name, ap.iata_code
            ORDER BY total_flights DESC
        `);
        
        // Using a CTE to find flights with multiple crew members
        const flightsWithMultipleCrew = await pool.query(`
            WITH flight_crew_counts AS (
                SELECT flight_id, COUNT(crew_member_id) as crew_count
                FROM flight_crew
                GROUP BY flight_id
            )
            SELECT f.id, f.flight_number, a.name as airline, fcc.crew_count
            FROM flight f
            JOIN airline a ON f.airline_id = a.id
            JOIN flight_crew_counts fcc ON f.id = fcc.flight_id
            WHERE fcc.crew_count > 1
            ORDER BY fcc.crew_count DESC
        `);
        
        // Calculate average flight durations by airline
        const avgFlightDurations = await pool.query(`
            SELECT a.name as airline, 
                   AVG(EXTRACT(EPOCH FROM (f.arrival_time - f.departure_time))/3600) as avg_duration_hours
            FROM flight f
            JOIN airline a ON f.airline_id = a.id
            GROUP BY a.name
            ORDER BY avg_duration_hours DESC
        `);
        
        await pool.query('COMMIT');
        
        res.status(200).json({
            message: "Database statistics retrieved successfully",
            data: {
                counts: {
                    flights: parseInt(flightCount.rows[0].count),
                    passengers: parseInt(passengerCount.rows[0].count),
                    airlines: parseInt(airlineCount.rows[0].count),
                    aircraft: parseInt(aircraftCount.rows[0].count),
                    airports: parseInt(airportCount.rows[0].count),
                    bookings: parseInt(bookingCount.rows[0].count),
                    crewMembers: parseInt(crewMemberCount.rows[0].count)
                },
                flightsPerAirline: flightsPerAirline.rows,
                flightsPerAirport: flightsPerAirport.rows,
                flightsWithMultipleCrew: flightsWithMultipleCrew.rows,
                avgFlightDurations: avgFlightDurations.rows
            }
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
console.log(`Server is running on http://localhost:${PORT}`);
console.log(`API endpoints available at:`);
console.log(`  - http://localhost:${PORT}/airlines`);
console.log(`  - http://localhost:${PORT}/airports`);
console.log(`  - http://localhost:${PORT}/aircraft`);
console.log(`  - http://localhost:${PORT}/flights`);
console.log(`  - http://localhost:${PORT}/passengers`);
console.log(`  - http://localhost:${PORT}/bookings`);
console.log(`  - http://localhost:${PORT}/crew-members`);
console.log(`  - http://localhost:${PORT}/api/health`);
console.log(`  - http://localhost:${PORT}/api/stats`);
});
4. Create Route Files
   Create the following route files in the routes directory:

routes/airlines.js:

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// GET all airlines
router.get('/', async (req, res) => {
try {
const airlines = await pool.query(`
            SELECT a.*, COUNT(f.id) as flight_count 
            FROM airline a
            LEFT JOIN flight f ON a.id = f.airline_id
            GROUP BY a.id
            ORDER BY a.name
        `);

        res.status(200).json({ message: "Airlines retrieved successfully", data: airlines.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET a specific airline
router.get('/:id', async (req, res) => {
try {
const { id } = req.params;

        const airline = await pool.query(`
            SELECT a.* 
            FROM airline a
            WHERE a.id = $1
        `, [id]);
        
        if (airline.rows.length === 0) {
            return res.status(404).json({ message: "Airline not found" });
        }
        
        // Get flights for this airline
        const flights = await pool.query(`
            SELECT f.id, f.flight_number, 
                   dep.name as departure_airport, dep.iata_code as departure_code,
                   arr.name as arrival_airport, arr.iata_code as arrival_code,
                   f.departure_time, f.arrival_time, f.status
            FROM flight f
            JOIN airport dep ON f.departure_airport_id = dep.id
            JOIN airport arr ON f.arrival_airport_id = arr.id
            WHERE f.airline_id = $1
            ORDER BY f.departure_time DESC
        `, [id]);
        
        // Get aircraft for this airline
        const aircraft = await pool.query(`
            SELECT id, registration_number, model, manufacturer, capacity
            FROM aircraft
            WHERE airline_id = $1
        `, [id]);
        
        const result = {
            ...airline.rows[0],
            flights: flights.rows,
            aircraft: aircraft.rows
        };
        
        res.status(200).json({ message: "Airline retrieved successfully", data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE a new airline
router.post('/', async (req, res) => {
try {
const { name, iata_code, country, founded_year } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Airline name is required" });
        }
        
        const id = uuidv4();
        const newAirline = await pool.query(
            "INSERT INTO airline (id, name, iata_code, country, founded_year) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [id, name, iata_code, country, founded_year]
        );
        
        res.status(201).json({ message: "Airline created successfully", data: newAirline.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE an airline
router.put('/:id', async (req, res) => {
try {
const { id } = req.params;
const { name, iata_code, country, founded_year } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Airline name is required" });
        }
        
        const updatedAirline = await pool.query(
            "UPDATE airline SET name = $1, iata_code = $2, country = $3, founded_year = $4 WHERE id = $5 RETURNING *",
            [name, iata_code, country, founded_year, id]
        );
        
        if (updatedAirline.rows.length === 0) {
            return res.status(404).json({ message: "Airline not found" });
        }
        
        res.status(200).json({ message: "Airline updated successfully", data: updatedAirline.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE an airline
router.delete('/:id', async (req, res) => {
try {
const { id } = req.params;

        // First check if airline exists
        const airline = await pool.query("SELECT * FROM airline WHERE id = $1", [id]);
        
        if (airline.rows.length === 0) {
            return res.status(404).json({ message: "Airline not found" });
        }
        
        // Delete the airline (flights will be deleted automatically due to CASCADE)
        await pool.query("DELETE FROM airline WHERE id = $1", [id]);
        
        res.status(200).json({ message: "Airline deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
routes/airports.js - Similar structure to airlines.js

routes/aircraft.js - Similar structure to airlines.js

routes/flights.js - Similar structure but with more complex relationships

routes/passengers.js - Similar structure to airlines.js

routes/bookings.js - Similar structure but with flight and passenger relationships

routes/crew-members.js - Similar structure to airlines.js

5. Create Frontend Interface
   Create a basic HTML interface in public/index.html with tabs for each entity:

Airlines
Airports
Aircraft
Flights
Passengers
Bookings
Crew Members
Statistics
Include forms for creating and editing each entity, and tables for displaying data.

Database Schema SQL
-- Create airline table
CREATE TABLE airline (
id VARCHAR(255) PRIMARY KEY,
name VARCHAR(100) NOT NULL,
iata_code VARCHAR(2),
country VARCHAR(100),
founded_year INTEGER
);

-- Create airport table
CREATE TABLE airport (
id VARCHAR(255) PRIMARY KEY,
name VARCHAR(100) NOT NULL,
iata_code VARCHAR(3),
city VARCHAR(100),
country VARCHAR(100),
latitude DECIMAL(10, 6),
longitude DECIMAL(10, 6)
);

-- Create aircraft table
CREATE TABLE aircraft (
id VARCHAR(255) PRIMARY KEY,
registration_number VARCHAR(20) NOT NULL,
model VARCHAR(50) NOT NULL,
manufacturer VARCHAR(50),
capacity INTEGER,
year_manufactured INTEGER,
airline_id VARCHAR(255),
CONSTRAINT fk_airline
FOREIGN KEY (airline_id)
REFERENCES airline(id)
ON DELETE SET NULL
);

-- Create flight table
CREATE TABLE flight (
id VARCHAR(255) PRIMARY KEY,
flight_number VARCHAR(10) NOT NULL,
departure_airport_id VARCHAR(255) NOT NULL,
arrival_airport_id VARCHAR(255) NOT NULL,
departure_time TIMESTAMP NOT NULL,
arrival_time TIMESTAMP NOT NULL,
aircraft_id VARCHAR(255),
airline_id VARCHAR(255),
status VARCHAR(20) DEFAULT 'Scheduled',
CONSTRAINT fk_departure_airport
FOREIGN KEY (departure_airport_id)
REFERENCES airport(id)
ON DELETE CASCADE,
CONSTRAINT fk_arrival_airport
FOREIGN KEY (arrival_airport_id)
REFERENCES airport(id)
ON DELETE CASCADE,
CONSTRAINT fk_aircraft
FOREIGN KEY (aircraft_id)
REFERENCES aircraft(id)
ON DELETE SET NULL,
CONSTRAINT fk_airline_flight
FOREIGN KEY (airline_id)
REFERENCES airline(id)
ON DELETE CASCADE
);

-- Create passenger table
CREATE TABLE passenger (
id VARCHAR(255) PRIMARY KEY,
first_name VARCHAR(50) NOT NULL,
last_name VARCHAR(50) NOT NULL,
email VARCHAR(100),
phone VARCHAR(20),
passport_number VARCHAR(20),
nationality VARCHAR(50),
date_of_birth DATE
);

-- Create booking table (junction table for flights and passengers)
CREATE TABLE booking (
id VARCHAR(255) PRIMARY KEY,
flight_id VARCHAR(255) NOT NULL,
passenger_id VARCHAR(255) NOT NULL,
booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
seat_number VARCHAR(5),
booking_status VARCHAR(20) DEFAULT 'Confirmed',
price DECIMAL(10, 2),
CONSTRAINT fk_flight
FOREIGN KEY (flight_id)
REFERENCES flight(id)
ON DELETE CASCADE,
CONSTRAINT fk_passenger
FOREIGN KEY (passenger_id)
REFERENCES passenger(id)
ON DELETE CASCADE,
CONSTRAINT unique_flight_seat
UNIQUE (flight_id, seat_number)
);

-- Create crew_member table
CREATE TABLE crew_member (
id VARCHAR(255) PRIMARY KEY,
first_name VARCHAR(50) NOT NULL,
last_name VARCHAR(50) NOT NULL,
position VARCHAR(50) NOT NULL,
airline_id VARCHAR(255),
license_number VARCHAR(20),
experience_years INTEGER,
CONSTRAINT fk_airline_crew
FOREIGN KEY (airline_id)
REFERENCES airline(id)
ON DELETE SET NULL
);

-- Create flight_crew table (junction table for flights and crew members)
CREATE TABLE flight_crew (
flight_id VARCHAR(255),
crew_member_id VARCHAR(255),
role VARCHAR(50) NOT NULL,
PRIMARY KEY (flight_id, crew_member_id),
CONSTRAINT fk_flight_crew
FOREIGN KEY (flight_id)
REFERENCES flight(id)
ON DELETE CASCADE,
CONSTRAINT fk_crew_member
FOREIGN KEY (crew_member_id)
REFERENCES crew_member(id)
ON DELETE CASCADE
);
Sample Data SQL
-- Sample data for airline table
INSERT INTO airline (id, name, iata_code, country, founded_year) VALUES
('a001', 'Delta Air Lines', 'DL', 'United States', 1924),
('a002', 'Lufthansa', 'LH', 'Germany', 1953),
('a003', 'Emirates', 'EK', 'United Arab Emirates', 1985),
('a004', 'Singapore Airlines', 'SQ', 'Singapore', 1947),
('a005', 'British Airways', 'BA', 'United Kingdom', 1974);

-- Sample data for airport table
INSERT INTO airport (id, name, iata_code, city, country, latitude, longitude) VALUES
('ap001', 'Hartsfield-Jackson Atlanta International Airport', 'ATL', 'Atlanta', 'United States', 33.6407, -84.4277),
('ap002', 'Frankfurt Airport', 'FRA', 'Frankfurt', 'Germany', 50.0379, 8.5622),
('ap003', 'Dubai International Airport', 'DXB', 'Dubai', 'United Arab Emirates', 25.2532, 55.3657),
('ap004', 'Singapore Changi Airport', 'SIN', 'Singapore', 'Singapore', 1.3644, 103.9915),
('ap005', 'London Heathrow Airport', 'LHR', 'London', 'United Kingdom', 51.4700, -0.4543);

-- Sample data for aircraft table
INSERT INTO aircraft (id, registration_number, model, manufacturer, capacity, year_manufactured, airline_id) VALUES
('ac001', 'N123DL', 'Boeing 777-200LR', 'Boeing', 291, 2010, 'a001'),
('ac002', 'D-ABCD', 'Airbus A380-800', 'Airbus', 509, 2015, 'a002'),
('ac003', 'A6-EEE', 'Boeing 777-300ER', 'Boeing', 354, 2016, 'a003'),
('ac004', '9V-SKA', 'Airbus A350-900', 'Airbus', 253, 2018, 'a004'),
('ac005', 'G-XWBA', 'Boeing 787-10', 'Boeing', 256, 2019, 'a005');

-- Sample data for flight table
INSERT INTO flight (id, flight_number, departure_airport_id, arrival_airport_id, departure_time, arrival_time, aircraft_id, airline_id, status) VALUES
('f001', 'DL001', 'ap001', 'ap005', '2023-06-15 08:00:00', '2023-06-15 20:30:00', 'ac001', 'a001', 'Completed'),
('f002', 'LH100', 'ap002', 'ap003', '2023-06-16 10:15:00', '2023-06-16 18:45:00', 'ac002', 'a002', 'Completed'),
('f003', 'EK500', 'ap003', 'ap004', '2023-06-17 01:30:00', '2023-06-17 13:15:00', 'ac003', 'a003', 'Completed'),
('f004', 'SQ321', 'ap004', 'ap002', '2023-06-18 23:45:00', '2023-06-19 06:30:00', 'ac004', 'a004', 'Scheduled'),
('f005', 'BA019', 'ap005', 'ap001', '2023-06-19 15:20:00', '2023-06-20 04:10:00', 'ac005', 'a005', 'Scheduled');

-- Sample data for passenger table
INSERT INTO passenger (id, first_name, last_name, email, phone, passport_number, nationality, date_of_birth) VALUES
('p001', 'John', 'Smith', 'john.smith@email.com', '+1-555-123-4567', 'US123456', 'American', '1985-03-21'),
('p002', 'Emma', 'Mueller', 'emma.mueller@email.com', '+49-555-234-5678', 'DE234567', 'German', '1990-07-15'),
('p003', 'Mohammed', 'Al-Farsi', 'mohammed.alfarsi@email.com', '+971-555-345-6789', 'UAE345678', 'Emirati', '1982-11-30'),
('p004', 'Li', 'Wei', 'li.wei@email.com', '+65-555-456-7890', 'SG456789', 'Singaporean', '1995-05-10'),
('p005', 'Sarah', 'Johnson', 'sarah.johnson@email.com', '+44-555-567-8901', 'UK567890', 'British', '1988-09-25');

-- Sample data for booking table
INSERT INTO booking (id, flight_id, passenger_id, booking_date, seat_number, booking_status, price) VALUES
('b001', 'f001', 'p001', '2023-05-20 14:30:00', '12A', 'Completed', 850.00),
('b002', 'f002', 'p002', '2023-05-22 09:45:00', '5F', 'Completed', 920.50),
('b003', 'f003', 'p003', '2023-05-25 16:20:00', '20C', 'Completed', 1250.75),
('b004', 'f004', 'p004', '2023-06-01 11:10:00', '8D', 'Confirmed', 1100.25),
('b005', 'f005', 'p005', '2023-06-05 13:40:00', '15B', 'Confirmed', 780.00);

-- Sample data for crew_member table
INSERT INTO crew_member (id, first_name, last_name, position, airline_id, license_number, experience_years) VALUES
('c001', 'Michael', 'Johnson', 'Captain', 'a001', 'PIL123456', 15),
('c002', 'Hans', 'Schmidt', 'First Officer', 'a002', 'PIL234567', 8),
('c003', 'Fatima', 'Al-Mansouri', 'Captain', 'a003', 'PIL345678', 12),
('c004', 'Chen', 'Mei', 'Flight Attendant', 'a004', 'CAB456789', 5),
('c005', 'James', 'Wilson', 'Flight Engineer', 'a005', 'ENG567890', 10);

-- Sample data for flight_crew table
INSERT INTO flight_crew (flight_id, crew_member_id, role) VALUES
('f001', 'c001', 'Captain'),
('f002', 'c002', 'First Officer'),
('f003', 'c003', 'Captain'),
('f004', 'c004', 'Lead Flight Attendant'),
('f005', 'c005', 'Flight Engineer');
API Endpoints
The system will provide the following RESTful API endpoints:

Airlines
GET /airlines - Get all airlines
GET /airlines/:id - Get a specific airline
POST /airlines - Create a new airline
PUT /airlines/:id - Update an airline
DELETE /airlines/:id - Delete an airline
Airports
GET /airports - Get all airports
GET /airports/:id - Get a specific airport
POST /airports - Create a new airport
PUT /airports/:id - Update an airport
DELETE /airports/:id - Delete an airport
Aircraft
GET /aircraft - Get all aircraft
GET /aircraft/:id - Get a specific aircraft
POST /aircraft - Create a new aircraft
PUT /aircraft/:id - Update an aircraft
DELETE /aircraft/:id - Delete an aircraft
Flights
GET /flights - Get all flights
GET /flights/:id - Get a specific flight
POST /flights - Create a new flight
PUT /flights/:id - Update a flight
DELETE /flights/:id - Delete a flight
Passengers
GET /passengers - Get all passengers
GET /passengers/:id - Get a specific passenger
POST /passengers - Create a new passenger
PUT /passengers/:id - Update a passenger
DELETE /passengers/:id - Delete a passenger
Bookings
GET /bookings - Get all bookings
GET /bookings/:id - Get a specific booking
POST /bookings - Create a new booking
PUT /bookings/:id - Update a booking
DELETE /bookings/:id - Delete a booking
Crew Members
GET /crew-members - Get all crew members
GET /crew-members/:id - Get a specific crew member
POST /crew-members - Create a new crew member
PUT /crew-members/:id - Update a crew member
DELETE /crew-members/:id - Delete a crew member
Flight Crew
GET /flights/:flightId/crew - Get all crew members for a flight
POST /flights/:flightId/crew/:crewMemberId - Add a crew member to a flight
DELETE /flights/:flightId/crew/:crewMemberId - Remove a crew member from a flight
Statistics
GET /api/health - Check database connection
GET /api/stats - Get database statistics
PostgreSQL Features Demonstrated
Foreign Key Constraints:

Flights reference airlines, aircraft, and airports
Bookings reference flights and passengers
Flight crew references flights and crew members
Cascading Deletes:

When a flight is deleted, all its bookings and crew assignments are automatically deleted
When an airline is deleted, all its flights are automatically deleted
Transactions:

Used in booking creation/update to ensure data consistency
Used in flight scheduling to ensure consistent point-in-time data
Common Table Expressions (CTEs):

Used in the statistics endpoint to find flights with multiple crew members
Used to calculate complex metrics like passenger load factors
JOIN Operations:

Various types of JOINs used throughout the application
LEFT JOIN to include airlines/airports with no flights
GROUP BY with Aggregations:

Used to count flights per airline and airport
Used to calculate average flight durations
Triggers and Stored Procedures (optional advanced features):

Automatically update flight status based on current time
Prevent overbooking by checking aircraft capacity
