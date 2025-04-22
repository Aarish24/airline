# Airline Management System

A comprehensive airline management system built with Node.js, Express, and PostgreSQL.

## Features

- Manage airlines, airports, aircraft, flights, passengers, bookings, and crew members
- RESTful API for all entities
- Basic web interface for data visualization and management
- Advanced database queries including transactions, joins, and CTEs
- Statistics dashboard with real-time data

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd airline-management-system
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up the PostgreSQL database:
   - Create a database named `airlinedb`
   - Run the SQL scripts in the `database` section of this README

4. Configure the database connection:
   - Open `db.js` and update the connection details with your PostgreSQL credentials

5. Start the application:
   ```
   node index.js
   ```

6. Access the application:
   - Web interface: http://localhost:4770
   - API endpoints: http://localhost:4770/api/...

## Database Schema

The system uses the following database tables:

1. `airline` - Information about airlines
2. `airport` - Information about airports
3. `aircraft` - Information about aircraft
4. `flight` - Information about flights
5. `passenger` - Information about passengers
6. `booking` - Information about bookings
7. `crew_member` - Information about crew members
8. `flight_crew` - Junction table for flights and crew members

## API Endpoints

- `/airlines` - CRUD operations for airlines
- `/airports` - CRUD operations for airports
- `/aircraft` - CRUD operations for aircraft
- `/flights` - CRUD operations for flights
- `/passengers` - CRUD operations for passengers
- `/bookings` - CRUD operations for bookings
- `/crew-members` - CRUD operations for crew members
- `/api/health` - Health check endpoint
- `/api/stats` - Statistics endpoint

## Database Setup

Connect to PostgreSQL and run the following commands:

```sql
-- Create database
CREATE DATABASE airlinedb;

-- Connect to the database
\c airlinedb

-- Create tables
CREATE TABLE airline (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    iata_code VARCHAR,
    country VARCHAR,
    founded_year INTEGER
);

CREATE TABLE airport (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    iata_code VARCHAR,
    city VARCHAR,
    country VARCHAR,
    latitude DECIMAL,
    longitude DECIMAL
);

CREATE TABLE aircraft (
    id VARCHAR PRIMARY KEY,
    registration_number VARCHAR NOT NULL,
    model VARCHAR NOT NULL,
    manufacturer VARCHAR,
    capacity INTEGER,
    year_manufactured INTEGER,
    airline_id VARCHAR REFERENCES airline(id)
);

CREATE TABLE flight (
    id VARCHAR PRIMARY KEY,
    flight_number VARCHAR NOT NULL,
    departure_airport_id VARCHAR REFERENCES airport(id),
    arrival_airport_id VARCHAR REFERENCES airport(id),
    departure_time TIMESTAMP NOT NULL,
    arrival_time TIMESTAMP NOT NULL,
    aircraft_id VARCHAR REFERENCES aircraft(id),
    airline_id VARCHAR REFERENCES airline(id),
    status VARCHAR
);

CREATE TABLE passenger (
    id VARCHAR PRIMARY KEY,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    email VARCHAR,
    phone VARCHAR,
    passport_number VARCHAR,
    nationality VARCHAR,
    date_of_birth DATE
);

CREATE TABLE booking (
    id VARCHAR PRIMARY KEY,
    flight_id VARCHAR REFERENCES flight(id),
    passenger_id VARCHAR REFERENCES passenger(id),
    booking_date TIMESTAMP,
    seat_number VARCHAR,
    booking_status VARCHAR,
    price DECIMAL
);

CREATE TABLE crew_member (
    id VARCHAR PRIMARY KEY,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    position VARCHAR NOT NULL,
    airline_id VARCHAR REFERENCES airline(id),
    license_number VARCHAR,
    experience_years INTEGER
);

CREATE TABLE flight_crew (
    flight_id VARCHAR REFERENCES flight(id),
    crew_member_id VARCHAR REFERENCES crew_member(id),
    role VARCHAR,
    PRIMARY KEY (flight_id, crew_member_id)
);
```

## Sample Data

Here's some sample data to get you started:

```sql
-- Insert sample airlines
INSERT INTO airline (id, name, iata_code, country, founded_year)
VALUES 
('a1', 'Air America', 'AA', 'United States', 1950),
('a2', 'British Airways', 'BA', 'United Kingdom', 1974),
('a3', 'Lufthansa', 'LH', 'Germany', 1953);

-- Insert sample airports
INSERT INTO airport (id, name, iata_code, city, country, latitude, longitude)
VALUES 
('ap1', 'John F. Kennedy International Airport', 'JFK', 'New York', 'United States', 40.6413, -73.7781),
('ap2', 'Heathrow Airport', 'LHR', 'London', 'United Kingdom', 51.4700, -0.4543),
('ap3', 'Frankfurt Airport', 'FRA', 'Frankfurt', 'Germany', 50.0379, 8.5622),
('ap4', 'Los Angeles International Airport', 'LAX', 'Los Angeles', 'United States', 33.9416, -118.4085);

-- Insert sample aircraft
INSERT INTO aircraft (id, registration_number, model, manufacturer, capacity, year_manufactured, airline_id)
VALUES 
('ac1', 'N12345', 'Boeing 747', 'Boeing', 366, 2010, 'a1'),
('ac2', 'G-XWBA', 'Airbus A350', 'Airbus', 331, 2015, 'a2'),
('ac3', 'D-ABCD', 'Boeing 777', 'Boeing', 300, 2012, 'a3'),
('ac4', 'N54321', 'Boeing 737', 'Boeing', 189, 2018, 'a1');

-- Insert sample flights
INSERT INTO flight (id, flight_number, departure_airport_id, arrival_airport_id, departure_time, arrival_time, aircraft_id, airline_id, status)
VALUES 
('f1', 'AA101', 'ap1', 'ap2', '2023-06-01 08:00:00', '2023-06-01 20:00:00', 'ac1', 'a1', 'Completed'),
('f2', 'BA202', 'ap2', 'ap3', '2023-06-02 09:30:00', '2023-06-02 11:30:00', 'ac2', 'a2', 'Completed'),
('f3', 'LH303', 'ap3', 'ap1', '2023-06-03 14:00:00', '2023-06-04 02:00:00', 'ac3', 'a3', 'Completed'),
('f4', 'AA404', 'ap1', 'ap4', '2023-06-05 10:00:00', '2023-06-05 13:00:00', 'ac4', 'a1', 'Scheduled');

-- Insert sample passengers
INSERT INTO passenger (id, first_name, last_name, email, phone, passport_number, nationality, date_of_birth)
VALUES 
('p1', 'John', 'Doe', 'john.doe@example.com', '123-456-7890', 'US123456', 'American', '1980-01-15'),
('p2', 'Jane', 'Smith', 'jane.smith@example.com', '234-567-8901', 'UK234567', 'British', '1985-05-20'),
('p3', 'Hans', 'Mueller', 'hans.mueller@example.com', '345-678-9012', 'DE345678', 'German', '1975-10-25');

-- Insert sample bookings
INSERT INTO booking (id, flight_id, passenger_id, booking_date, seat_number, booking_status, price)
VALUES 
('b1', 'f1', 'p1', '2023-05-01 12:00:00', '12A', 'Confirmed', 450.00),
('b2', 'f2', 'p2', '2023-05-02 14:30:00', '15F', 'Confirmed', 320.00),
('b3', 'f3', 'p3', '2023-05-03 09:15:00', '22C', 'Confirmed', 580.00),
('b4', 'f4', 'p1', '2023-05-04 16:45:00', '8B', 'Confirmed', 275.00);

-- Insert sample crew members
INSERT INTO crew_member (id, first_name, last_name, position, airline_id, license_number, experience_years)
VALUES 
('c1', 'Michael', 'Johnson', 'Pilot', 'a1', 'PIL123', 15),
('c2', 'Sarah', 'Williams', 'Flight Attendant', 'a1', 'FA234', 8),
('c3', 'Robert', 'Brown', 'Pilot', 'a2', 'PIL345', 20),
('c4', 'Emily', 'Jones', 'Flight Attendant', 'a2', 'FA456', 5),
('c5', 'Thomas', 'Schmidt', 'Pilot', 'a3', 'PIL567', 12),
('c6', 'Anna', 'Fischer', 'Flight Attendant', 'a3', 'FA678', 10);

-- Insert sample flight crew assignments
INSERT INTO flight_crew (flight_id, crew_member_id, role)
VALUES 
('f1', 'c1', 'Captain'),
('f1', 'c2', 'Lead Flight Attendant'),
('f2', 'c3', 'Captain'),
('f2', 'c4', 'Lead Flight Attendant'),
('f3', 'c5', 'Captain'),
('f3', 'c6', 'Lead Flight Attendant'),
('f4', 'c1', 'Captain'),
('f4', 'c2', 'Lead Flight Attendant');
```

## License

This project is licensed under the MIT License.