const { io } = require('socket.io-client');
const socket = io('https://smart-kiosk-ttut.onrender.com');
socket.on('connect', () => {
  console.log('Connected, emitting...');
  // Nu putem emite din client la fel ca de pe server, io.emit() pe server trimite la clienți.
  // Clienții nu pot trimite evenimente "broadast" către alți clienți direct decât dacă serverul face relay.
  // În payment.js, serverul face io.emit()
});
