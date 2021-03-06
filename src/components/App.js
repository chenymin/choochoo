import React, { Suspense, useState, useEffect, useRef } from 'react';
import SunAndCloudsWEBP from '../assets/images/sunny-day.webp';
import SunAndCloudsPNG from '../assets/images/sunny-day.png';
import NetworkDialogue from './reusables/NetworkDialogue';
import Spinner from './reusables/Spinner';
import CSS from '../css/App.module.css';

const WelcomeView = React.lazy(() => import('./views/WelcomeView'));
const MainView = React.lazy(() => import('./views/MainView'));
const SettingsView = React.lazy(() => import('./views/SettingsView'));

// TODO: Setup theming system with context and make different themes for night, stormy, etc.
function App() {
  const [stationObj, setStationObj] = useState('');
  const [name, setName] = useState('');
  const [line, setLine] = useState('');
  const [view, setView] = useState('');

  const [networkIssue, setNetworkIssue] = useState('');
  const [reqOn, setReqOn] = useState(true);
  const timerRef = useRef();

  const networkRetry = (tries, cb, url, ...params) => {
    if (tries === 0) {
      setNetworkIssue('Tries exceeded, try reloading?');
      return false;
    }

    return new Promise(res => {
      console.log(`Retrying network, attempt: ${tries}`);
      if (navigator.onLine) {
        fetch(url)
          .then(resp => {
            if (!resp.ok) throw resp;
            return resp.json();
          })
          .then(json => {
            // If we're back online invoke the cb and undo errors.
            if (cb) cb(json, ...params);
            res(true);
            setNetworkIssue('');
          })
          .catch(err => {
            if (networkIssue !== 'Unable to connect to server') setNetworkIssue('Unable to connect to server');
            console.log('Error caught: ', err);
            // If sill offline, wait 10 seconds and try again.
            setTimeout(() => networkRetry(tries - 1, cb, url, ...params), 10 * 1000);
          });
      } else {
        if (!networkIssue) setNetworkIssue('Internet down');
        setTimeout(() => networkRetry(tries - 1, cb, url, ...params), 10 * 1000);
      }
    });
  };

  // When invoked, check if the user is online. If they are, check if the server is online.
  const networkError = (msg, retry, cb, url, ...params) => {
    if (retry && !networkIssue) {
      // If requested to retry, send to async network retry system.
      networkRetry(5, cb, url, ...params);
    } else {
      // Using this for rate limit, but it's usable for other things.
      setNetworkIssue(msg);
    }
  };

  const saveChanges = (newName, newStationObj, newLine) => {
    // Submit the state to the localStorage.
    if (!newStationObj || !newLine) {
      throw new Error("saveChanges wasn't given proper variables");
    }

    localStorage.setItem('stationObj', JSON.stringify(newStationObj));
    localStorage.setItem('name', newName);
    localStorage.setItem('line', newLine);
    setStationObj(newStationObj);
    setName(newName);
    setLine(newLine);
    setView('main');
  };

  // If the user leaves the tab for more than n seconds, pause requests and restart them when they come back.
  const visibilityChange = () => {
    if (document.hidden) {
      if (!timerRef.current) {
        const timer = window.setTimeout(() => {
          // If it reaches inside here that means the page has been hidden for > 60 seconds, so stop reqs and clear self.
          setReqOn(false);
          timerRef.current = undefined;
        }, 60 * 1000);
        timerRef.current = timer;
      }
    } else if (timerRef.current) {
      // If document becomes visible while timer is still underway, clear it.
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    } else setReqOn(true);
  };

  useEffect(() => {
    // On first load check if we have data. If we don't have any data, show welcome view. If we do, show mainView.
    const checkStorage = key => localStorage.getItem(key) || '';
    const newName = checkStorage('name');
    const newLine = checkStorage('line');
    const newStationObj = JSON.parse(checkStorage('stationObj') || '{}');
    setName(newName);
    setLine(newLine);
    setStationObj(newStationObj);
    if (newStationObj && newLine) {
      setView('main');
    } else setView('welcome');

    document.addEventListener('visibilitychange', visibilityChange);
    return () => document.removeEventListener('visibilitychange', visibilityChange);

    // Depending on the time of day present different themes.
  }, []);

  // General parent stylings setting the header img, fonts, bg color.
  return (
    <div className={CSS.App}>
      <header className={CSS.imgContainer}>
        <picture>
          <source srcSet={SunAndCloudsWEBP} type="image/webp" />
          <source srcSet={SunAndCloudsPNG} type="image/png" />
          <img src={SunAndCloudsPNG} className={CSS.headerImg} alt="Sun And Clouds" />
        </picture>
      </header>
      <div className={CSS.content}>
        <NetworkDialogue message={networkIssue} />
        <Suspense
          ms={700}
          fallback={
            <div className={CSS.centerSpinner}>
              <Spinner />
            </div>
          }
        >
          {view === 'welcome' && <WelcomeView saveChanges={saveChanges} networkError={networkError} />}
          {view === 'main' && (
            <MainView
              name={name}
              stationObj={stationObj}
              line={line}
              reqOn={reqOn}
              networkError={networkError}
              gotoSettings={() => setView('settings')}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              initData={{
                name,
                stationObj,
                line
              }}
              networkError={networkError}
              saveChanges={saveChanges}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
export default App;
