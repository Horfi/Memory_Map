// DateRangePicker.jsx

import React from 'react';

function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange }) {
  // Get earliest and latest possible dates from the current date
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  
  const formatDateForInput = (date) => {
    if (!date) return '';
    return date instanceof Date 
      ? date.toISOString().split('T')[0] 
      : date;
  };

  return (
    <div className="date-range-picker">
      <div className="date-picker-field">
        <label htmlFor="start-date">Start Date:</label>
        <input
          type="date"
          id="start-date"
          value={formatDateForInput(startDate)}
          max={formatDateForInput(endDate || today)}
          onChange={(e) => onStartDateChange(e.target.value)}
        />
      </div>
      
      <div className="date-picker-field">
        <label htmlFor="end-date">End Date:</label>
        <input
          type="date"
          id="end-date"
          value={formatDateForInput(endDate)}
          min={formatDateForInput(startDate)}
          max={formatDateForInput(today)}
          onChange={(e) => onEndDateChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export default DateRangePicker;