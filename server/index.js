/* eslint-disable camelcase */
const express = require('express');
const cors = require('cors');
const MTA = require('mta-gtfs');
const Fuse = require('fuse.js');
const data = require('./stopList.json');

const app = express();
app.use(cors());

// Get the oncoming trains given a stopId and fieldId.
app.get('/schedule/:stopId/', (req, res, next) => {
  const { stopId } = req.params;
  const { direction, feed_id } = req.query;
  if (stopId === undefined || stopId === null) {
    res.json({ error: 'Missing stopId parameter' });
    return;
  }

  // A function to return all closest trains given a schedule.
  const getTrains = (schedule, countPerDir = 5) => {
    // Get the current (3 length) second count for comparison.
    let currTime = Date.now().toString();
    currTime = +currTime.substring(0, currTime.length - 3);

    // Get the nearest `countPerDir` train arrivals in your given direction. Or, if no direction given, include both directions.
    // Populate North
    const N = [];
    if (direction === 'N' || direction !== 'S') {
      for (let i = 0; N.length < countPerDir && i < schedule[stopId].N.length; ++i) {
        const { routeId, arrivalTime } = schedule[stopId].N[i];
        // If arrival time is null I'm assuming that means it's at the station? Maybe returning 0 would be better for FE, hmm.

        if (arrivalTime < currTime) continue; // BUG: Occasionally an arrivalTime will be in the past? Just assume data integrity err and skip it.
        const eta = arrivalTime === null ? 'At the station' : arrivalTime - currTime;
        N.push({ routeId, eta });
      }
    }

    // Populate South
    const S = [];
    if (direction === 'S' || direction !== 'N') {
      for (let i = 0; S.length < countPerDir && i < schedule[stopId].S.length; ++i) {
        const { routeId, arrivalTime } = schedule[stopId].S[i];

        if (arrivalTime < currTime) continue;
        const eta = arrivalTime === null ? 'At the station' : arrivalTime - currTime;
        S.push({ routeId, eta });
      }
    }

    return [N, S];
  };

  // If a feed_id was passed in, return the results just for that feed_id.
  // Otherwise, compose a result array from trying all the feed_id's.

  if (!feed_id) {
    // If I'm not given a feed_id return a list of all of them
    const potentialLines = [1, 26, 16, 21, 2, 11, 31, 36, 51];
    (async function loop() {
      const results = {};
      for (let i = 0; i < potentialLines.length; ++i) {
        const feedId = potentialLines[i];
        const mta = new MTA({
          key: '6fdbd192a4cc961fa30c69c9607abcbf',
          feed_id: feedId
        });

        try {
          /* eslint-disable-next-line */
          const { schedule } = await mta.schedule(stopId);
          // If that feed_id exists at that stop, add it to our results.
          if (schedule) {
            const [N, S] = getTrains(schedule);
            results[feedId] = { N, S };
          }
        } catch (err) {
          console.error(err);
        }
      }
      res.json(results);
    })();
  } else {
    const mta = new MTA({
      key: '6fdbd192a4cc961fa30c69c9607abcbf',
      feed_id: +feed_id
    });

    mta
      .schedule(stopId)
      .then(({ schedule }) => {
        if (!schedule) {
          res.json({ error: 'No feed_id at this stopId', feed_id, stopId });
          return;
        }
        const [N, S] = getTrains(schedule, 5);
        res.json({ feed_id: { N, S } });
      })
      .catch(next);
  }
});

app.get('/searchStops/', (req, res, next) => {
  const { query } = req.query;
  if (!query) {
    next('No query sent');
    return;
  }
  const fuse = new Fuse(data, {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 3,
    keys: ['stop_name', 'stop_id']
  });
  const results = fuse.search(query);
  // Only get the top 5 search results.
  if (results.length > 5) {
    res.json(results.slice(0, 5));
  }
  res.json(results);
});

// Get info on stops or any specific stop.
app.get('/stopInfo', (req, res, next) => {
  const mta = new MTA({
    key: '6fdbd192a4cc961fa30c69c9607abcbf',
    feed_id: 1
  });

  const { id } = req.query;
  if (!id) {
    // If no id given just return all stops
    res.json(data);
  } else {
    mta
      .stop(id)
      .then(stopInfo => {
        if (stopInfo === undefined) throw new Error(`Invalid id: ${id}`);
        res.json({ stopInfo });
      })
      .catch(next);
  }
});

app.use((_, res) => {
  res.status(404).send("Route doesn't exist.");
});

app.listen(3001, () => console.log('Server running on port 3001.'));