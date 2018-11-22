import React, { useStatus, useEffect } from 'react';
import PropTypes from 'prop-types';
import CSS from '../../css/TrainStatus.module.css';

function TrainStatus({ status, line }) {
  // Use line (or routeId off status?) to get the relevant image.
  return (
    <section className={CSS.TrainStatus}>
      <div className={CSS.timeContainer}>
        <span className={CSS.arrivalTime}>{Math.round(status.arrivalTime / 60)}</span>
        <span className={CSS.min}>min</span>
      </div>
      <div className={CSS.routeId}>
        {status.routeId}
      </div>
      <div className={CSS.trainPathContainer}>
        {status.arrivalTime}
      </div>
    </section>
  );
}

TrainStatus.propTypes = {
  status: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  line: PropTypes.string,
};

TrainStatus.defaultProps = {
  status: {},
  line: '',
};

export default TrainStatus;