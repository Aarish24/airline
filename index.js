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