const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const querystring = require('querystring');
const request = require('request');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const client_id = 'ycc1d2271c0224398bda6c13059713614';
const client_secret = 'aa416b23ade3448a97f6b4bd98136f2a';
const redirect_uri = 'http://localhost:3000/callback';

const rooms = {};

wss.on('connection', socket => {
    socket.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'CREATE_ROOM') {
            const roomId = generateRoomId();
            rooms[roomId] = { creator: socket, members: [] };
            socket.send(JSON.stringify({ type: 'ROOM_CREATED', roomId }));
        } else if (data.type === 'JOIN_ROOM') {
            const roomId = data.inviteCode;
            if (rooms[roomId]) {
                rooms[roomId].members.push(socket);
                socket.send(JSON.stringify({ type: 'JOINED_ROOM', roomId }));
            } else {
                socket.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
            }
        } else if (data.type === 'SELECT_SONG') {
            const roomId = data.roomId;
            const songUri = data.songUri;
            if (rooms[roomId]) {
                rooms[roomId].members.forEach(member => {
                    member.send(JSON.stringify({ type: 'PLAY_SONG', songUri }));
                });
            }
        }
    });

    socket.on('close', () => {
        // Handle socket close event
    });
});

function generateRoomId() {
    return Math.random().toString(36).substring(2, 10);
}

app.get('/login', (req, res) => {
    const scope = 'user-read-private user-read-email user-modify-playback-state';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
        }));
});

app.get('/callback', (req, res) => {
    const code = req.query.code || null;
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code',
        },
        headers: {
            'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64')),
        },
        json: true,
    };

    request.post(authOptions, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token;
            res.send({ access_token });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
