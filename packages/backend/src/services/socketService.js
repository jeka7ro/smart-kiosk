/**
 * Socket.IO Service
 * Manages real-time communication between backend, kiosk, QR web, and kitchen display
 */

let _io = null;

function initSocket(io) {
  _io = io;

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Kitchen Display joins — both legacy 'join' and new 'join_room' events
    socket.on('join', ({ role, locationId }) => {
      if (role === 'kitchen') {
        socket.join(`kitchen-${locationId}`);
        console.log(`[Socket] Kitchen joined: kitchen-${locationId}`);
      } else if (role === 'kiosk') {
        socket.join(`kiosk-${locationId}`);
      } else if (role === 'admin') {
        socket.join('admin');
      }
    });

    // KDS simplified join (just joins global kitchen room)
    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`[Socket] ${socket.id} joined room: ${room}`);
    });

    // KDS updates order status — broadcast to everyone
    socket.on('update_order_status', ({ orderId, status }) => {
      io.emit('order_status_updated', { orderId, status });
    });

    // Kitchen marks order as ready → notify kiosk/QR client
    socket.on('order_ready', ({ orderId, locationId }) => {
      io.to(`kiosk-${locationId}`).emit('order_ready', { orderId });
      io.to('admin').emit('order_ready', { orderId, locationId });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

function emitToKitchen(locationId, event, data) {
  if (_io) _io.to(`kitchen-${locationId}`).emit(event, data);
}

function emitToAll(event, data) {
  if (_io) _io.emit(event, data);
}

module.exports = { initSocket, emitToKitchen, emitToAll };
