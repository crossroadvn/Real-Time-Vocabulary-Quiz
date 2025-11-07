import { useEffect, useMemo, useRef, useState, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Paper,
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  Stack,
  Divider,
  IconButton,
  useTheme,
} from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { ColorModeContext } from './main';

type LeaderboardEntry = {
  userId: string;
  username: string;
  score: number;
  rank: number;
};

type LeaderboardPayload = {
  quizId: string;
  leaderboard: LeaderboardEntry[];
  userScore: number;
};

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? 'http://localhost:4000';

// AI-ASSISTED: Hook structure and socket lifecycle drafted with AI pair-programming, refined manually for state handling.
export default function App() {
  const [quizId, setQuizId] = useState('demo-quiz');
  const [userId, setUserId] = useState<string>(() => crypto.randomUUID());
  const [username, setUsername] = useState('Player 1');
  const [questionId, setQuestionId] = useState('vocab-1');
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('Not connected');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userScore, setUserScore] = useState(0);
  const [lastFeedback, setLastFeedback] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);

  const socketRef = useRef<Socket | null>(null);

  const socket = useMemo(() => {
    return io(REALTIME_URL, { autoConnect: false });
  }, []);

  useEffect(() => {
    socketRef.current = socket;

    socket.on('connect', () => setStatus('Connected'));
    socket.on('disconnect', () => setStatus('Disconnected'));
    socket.on('leaderboard_update', (payload: LeaderboardPayload) => {
      setLeaderboard(payload.leaderboard);
      setUserScore(payload.userScore);
    });

    socket.connect();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('leaderboard_update');
      socket.disconnect();
    };
  }, [socket]);

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    const client = socketRef.current;
    if (!client) return;

    client.emit(
      'join_quiz',
      { quizId, userId, username },
      (response: { status?: string; error?: string; leaderboard?: LeaderboardPayload }) => {
        if (response?.error) {
          setStatus(`Join failed: ${response.error}`);
          return;
        }
        if (response?.leaderboard) {
          setLeaderboard(response.leaderboard.leaderboard);
          setUserScore(response.leaderboard.userScore);
        }
        setStatus('Joined quiz');
        setIsJoined(true);
      }
    );
  }

  async function handleSubmitAnswer(event: React.FormEvent) {
    event.preventDefault();
    const client = socketRef.current;
    if (!client) return;

    client.emit(
      'submit_answer',
      { quizId, userId, username, questionId, answer },
      (response: { correct?: boolean; delta?: number; newScore?: number; error?: string }) => {
        if (response?.error) {
          setLastFeedback(response.error);
          return;
        }
        if (typeof response?.newScore === 'number') {
          setUserScore(response.newScore);
        }

        const correctness = response?.correct ? 'Correct! 🎉' : 'Incorrect.';
        setLastFeedback(`${correctness} ${response?.delta ? `Delta: ${response.delta}` : ''}`.trim());
        setAnswer('');
      }
    );
  }

  function handleLeave() {
    const client = socketRef.current;
    setIsJoined(false);
    setLastFeedback('');
    setLeaderboard([]);
    setUserScore(0);
    setAnswer('');
    setQuestionId('vocab-1');

    if (client?.connected) {
      setStatus('Connected');
    } else if (client) {
      setStatus('Disconnected');
    } else {
      setStatus('Not connected');
    }
  }

  const connectionColor: 'default' | 'success' | 'warning' =
    status === 'Connected' ? 'success' : status === 'Joined quiz' ? 'success' : status === 'Disconnected' ? 'warning' : 'default';

  return (
    <Box>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Real-Time Vocabulary Quiz
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip label={`Score: ${userScore}`} color="default" variant="outlined" />
            <Chip label={status} color={connectionColor} />
            {isJoined && <Chip label={username} color="primary" variant="outlined" />}
            {isJoined && (
              <Button color="inherit" onClick={handleLeave} sx={{ textTransform: 'none' }}>
                Leave Quiz
              </Button>
            )}
            <IconButton color="inherit" onClick={colorMode.toggleColorMode} aria-label="toggle dark mode">
              {theme.palette.mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {isJoined ? (
        <MainQuizScreen
          quizId={quizId}
          questionId={questionId}
          answer={answer}
          username={username}
          leaderboard={leaderboard}
          userId={userId}
          lastFeedback={lastFeedback}
          onQuestionIdChange={(value) => setQuestionId(value)}
          onAnswerChange={(value) => setAnswer(value)}
          onSubmit={handleSubmitAnswer}
        />
      ) : (
        <JoinQuizScreen
          quizId={quizId}
          userId={userId}
          username={username}
          onQuizIdChange={(value) => setQuizId(value)}
          onUserIdChange={(value) => setUserId(value)}
          onUsernameChange={(value) => setUsername(value)}
          onSubmit={handleJoin}
        />
      )}
    </Box>
  );
}

type JoinQuizScreenProps = {
  quizId: string;
  userId: string;
  username: string;
  onQuizIdChange: (value: string) => void;
  onUserIdChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function JoinQuizScreen({
  quizId,
  userId,
  username,
  onQuizIdChange,
  onUserIdChange,
  onUsernameChange,
  onSubmit,
}: JoinQuizScreenProps) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Paper elevation={6} sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" component="h2" gutterBottom>
              Join a Quiz
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Enter the quiz details below to start playing in real time.
            </Typography>
          </Box>
          <Box component="form" onSubmit={onSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Quiz ID"
                value={quizId}
                onChange={(event) => onQuizIdChange(event.target.value)}
                required
                fullWidth
              />
              <TextField
                label="User ID"
                value={userId}
                onChange={(event) => onUserIdChange(event.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Username"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                required
                fullWidth
              />
              <Button type="submit" variant="contained" size="large">
                Join Quiz
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}

type MainQuizScreenProps = {
  quizId: string;
  questionId: string;
  answer: string;
  username: string;
  leaderboard: LeaderboardEntry[];
  userId: string;
  lastFeedback: string;
  onQuestionIdChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function MainQuizScreen({
  quizId,
  questionId,
  answer,
  username,
  leaderboard,
  userId,
  lastFeedback,
  onQuestionIdChange,
  onAnswerChange,
  onSubmit,
}: MainQuizScreenProps) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Submit Answer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Playing as{' '}
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {username}
                  </Box>{' '}
                  in quiz{' '}
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {quizId}
                  </Box>
                  .
                </Typography>
              </Box>
              <Box component="form" onSubmit={onSubmit} noValidate>
                <Stack spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel id="question-select-label">Question ID</InputLabel>
                    <Select
                      labelId="question-select-label"
                      value={questionId}
                      label="Question ID"
                      onChange={(event) => onQuestionIdChange(event.target.value as string)}
                    >
                      <MenuItem value="vocab-1">vocab-1</MenuItem>
                      <MenuItem value="vocab-2">vocab-2</MenuItem>
                      <MenuItem value="vocab-3">vocab-3</MenuItem>
                      <MenuItem value="vocab-4">vocab-4</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Answer"
                    value={answer}
                    onChange={(event) => onAnswerChange(event.target.value)}
                    required
                    fullWidth
                  />
                  <Button type="submit" variant="contained" color="secondary" size="large">
                    Submit Answer
                  </Button>
                </Stack>
              </Box>
              {lastFeedback && (
                <Alert sx={{ mt: 1 }} severity={lastFeedback.startsWith('Correct') ? 'success' : 'info'}>
                  {lastFeedback}
                </Alert>
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6">Leaderboard</Typography>
              <Divider sx={{ flexGrow: 1, mx: 2 }} />
              <Chip label={`Quiz: ${quizId}`} variant="outlined" />
            </Stack>
            <TableContainer>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Player</TableCell>
                    <TableCell align="right">Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaderboard.map((entry) => (
                    <TableRow key={entry.userId} selected={entry.userId === userId} hover>
                      <TableCell>{entry.rank}</TableCell>
                      <TableCell>{entry.username}</TableCell>
                      <TableCell align="right">{entry.score}</TableCell>
                    </TableRow>
                  ))}
                  {leaderboard.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary">
                          No scores yet. Submit an answer to appear on the board.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

