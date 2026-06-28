const net = require('net');

const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;

function calculateLRC(buffer) {
    let lrc = 0;
    for (let i = 1; i < buffer.length - 1; i++) {
        lrc ^= buffer[i];
    }
    return lrc;
}

function buildMessage(messageId, messageType, payload) {
    const msg = messageId + messageType + '.' + payload;
    const msgBuffer = Buffer.from(msg, 'ascii');
    const outBuf = Buffer.alloc(msgBuffer.length + 3);
    outBuf[0] = STX;
    msgBuffer.copy(outBuf, 1);
    outBuf[outBuf.length - 2] = ETX;
    outBuf[outBuf.length - 1] = calculateLRC(outBuf);
    return outBuf;
}

const server = net.createServer((socket) => {
    console.log('[Mock POS] Client connected:', socket.remoteAddress);
    
    let buffer = Buffer.alloc(0);
    
    socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        
        let offset = 0;
        while (offset < buffer.length) {
            const byte = buffer[offset];
            
            if (byte === STX) {
                const etxIndex = buffer.indexOf(ETX, offset);
                if (etxIndex !== -1) {
                    const msgFrame = buffer.slice(offset, etxIndex + 2);
                    const lrcCalculated = calculateLRC(msgFrame);
                    const lrcReceived = msgFrame[msgFrame.length - 1];
                    
                    if (lrcCalculated !== lrcReceived) {
                        console.log('[Mock POS] Bad LRC sequence!');
                        socket.write(Buffer.from([NAK]));
                        return;
                    }
                    
                    const payload = msgFrame.slice(1, -2).toString('ascii');
                    
                    if (payload.startsWith('MOL10.')) {
                        console.log(`[Mock POS] Received Payment Request (10): ${payload}`);
                        
                        // 1. Send ACK
                        socket.write(Buffer.from([ACK]));
                        
                        // 2. Send 11 (Initiate Response)
                        setTimeout(() => {
                            console.log(`[Mock POS] Sending Initiate Response (11)...`);
                            const cmd11 = buildMessage('MOL', '11', '');
                            socket.write(cmd11);
                        }, 500); // Simulate processing delay
                    }
                    else if (payload.startsWith('MOL13.')) {
                         console.log(`[Mock POS] Received Terminal Ack (13). Closing.`);
                         socket.write(Buffer.from([ACK]));
                         socket.destroy();
                    }
                    
                    offset = etxIndex + 2;
                } else {
                    break; // Wait for more data
                }
            } else if (byte === ACK) {
                console.log(`[Mock POS] Received ACK from Host`);
                
                // If we get an ACK, blindly assume it's for our MOL11, so let's send MOL12 (Simulation)
                // In production, we'd keep a state machine.
                setTimeout(() => {
                    console.log(`[Mock POS] Simulating successful user card tap/PIN...`);
                    // Response: 00 = Success. We add dummy card data.
                    const payload12 = "00xxxxxxxxxxxx1234\x1c2512123456123456241231120000Visa\x1c";
                    const cmd12 = buildMessage('MOL', '12', payload12);
                    socket.write(cmd12);
                    console.log(`[Mock POS] Sent Auth Result (12) - Payment Approved.`);
                }, 3000); // Simulate client looking for card in wallet (3 seconds)
                
                offset++;
            } else {
                offset++;
            }
        }
        
        if (offset > 0) buffer = buffer.slice(offset);
    });

    socket.on('error', (err) => {
        console.error('[Mock POS] Socket Error:', err.message);
    });

    socket.on('close', () => {
        console.log('[Mock POS] Connection closed.\n');
    });
});

const PORT = 1000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mock POS Emulator] Listening on port ${PORT}...`);
    console.log(`Ready to accept pseudo-card payments for testing!`);
});
