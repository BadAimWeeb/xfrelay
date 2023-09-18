import { useEffect, useState } from 'react'
import { Paper, Typography, TextField, IconButton, InputAdornment, Tooltip, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Button } from "@mui/material";
import BoltIcon from '@mui/icons-material/Bolt';
import RefreshIcon from '@mui/icons-material/Refresh';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function App() {
    let [activeTab, setActiveTab] = useState(0);
    let [activeFCAInstance, setActiveFCAInstance] = useState(0);
    let [connected, setConnected] = useState(false);

    useEffect(() => {
        let listener = (changes: { [key: string]: chrome.storage.StorageChange; }) => {
            if (changes.status) {
                setConnected(changes.status.newValue?.connected ?? false);
                setActiveTab(changes.status.newValue?.activeTab ?? 0);
                setActiveFCAInstance(changes.status.newValue?.activeFCAInstance ?? 0);
            }
        };
        chrome.storage.session.onChanged.addListener(listener);

        chrome.storage.session.get("status", (result) => {
            setConnected(result.status?.connected ?? false);
            setActiveTab(result.status?.activeTab ?? 0);
            setActiveFCAInstance(result.status?.activeFCAInstance ?? 0);
        });

        chrome.storage.local.get("config", (result) => {
            setMode(result.config?.mode ?? 1);
            setRelayServerAddress(result.config?.relayServerAddress ?? "");
            setAccountID(result.config?.accountID ?? "");
            setEncryptionKey(result.config?.encryptionKey ?? "");
        });

        return () => {
            chrome.storage.session.onChanged.removeListener(listener);
        }
    }, []);

    let [mode, setMode] = useState(1);

    // mode 1: use a relay server
    let [relayServerAddress, setRelayServerAddress] = useState("");
    let [accountID, setAccountID] = useState("");
    // mode 2: use libp2p
    let [p2pID, _setP2PID] = useState("1D...");

    let [encryptionKey, setEncryptionKey] = useState("");
    let [viewEncryptionKey, setViewEncryptionKey] = useState(false);

    return (
        <Paper style={{ flexGrow: 100, borderRadius: 0, padding: 16, width: 250, paddingBottom: 48 }}>
            <Typography variant="h3" style={{
                textAlign: "center",
                width: 250,
            }}>XFRelay <BoltIcon color={connected ? "success" : "error"} sx={{ position: "absolute" }} /></Typography><br />
            {/* active tab connection count */}
            <Typography variant="body1"><b>{activeTab}</b> active FBMSG tab(s)</Typography>
            <Typography variant="body1"><b>{activeFCAInstance}</b> active remote instance(s)</Typography>
            <br />

            <FormControl>
                <FormLabel id="transmitmode-label">Transmit mode</FormLabel>
                <RadioGroup
                    aria-labelledby="transmitmode-label"
                    defaultValue="1"
                    name="transmitmode"
                    onChange={e => setMode(parseInt(e.target.value))}
                    value={mode}
                >
                    <FormControlLabel value="1" control={<Radio />} label="Use a relay server" />
                    <FormControlLabel value="2" control={<Radio />} label="Use libp2p" />
                </RadioGroup>
            </FormControl>

            {mode === 1 ? (
                <>
                    {/* relay server address */}
                    <TextField
                        label="Relay Server Address"
                        variant="standard"
                        fullWidth
                        value={relayServerAddress}
                        onChange={e => setRelayServerAddress(e.target.value)}
                    /><br /><br />
                    {/* account id */}
                    <TextField
                        label="Account ID"
                        variant="standard"
                        fullWidth
                        value={accountID}
                        onChange={e => setAccountID(e.target.value)}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Tooltip title="Generate new ID">
                                        <IconButton aria-label="generate new ID" edge="end" onClick={() => {
                                            // Generate new UUID
                                            let k = crypto.randomUUID();

                                            setAccountID(k);
                                        }}>
                                            <RefreshIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Copy ID to clipboard">
                                        <IconButton aria-label="copy ID to clipboard" edge="end" onClick={() => {
                                            // Copy to clipboard
                                            navigator.clipboard.writeText(accountID);
                                        }}>
                                            <ContentCopyIcon />
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            )
                        }}
                    /><br />
                </>
            ) : (
                <>
                    <Typography variant="body1">
                        <b>libp2p</b> is not yet supported.
                    </Typography>
                    <Typography variant="body1">
                        P2P ID: <b>{p2pID}</b>
                    </Typography>
                </>
            )}
            <br />
            {/* Encryption key */}
            <TextField
                label="Encryption Key"
                variant="standard"
                fullWidth
                type={viewEncryptionKey ? "text" : "password"}
                value={encryptionKey}
                onChange={e => setEncryptionKey(e.target.value)}
                error={encryptionKey.length !== 64 || !/^[0-9a-fA-F]+$/g.test(encryptionKey)}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <Tooltip title="Generate and copy new key">
                                <IconButton aria-label="generate and copy new key" edge="end" onClick={() => {
                                    // Generate new AES256 (32 byte) key
                                    let k = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                                        .map(v => v.toString(16).padStart(2, "0"))
                                        .join("");

                                    // Copy to clipboard
                                    navigator.clipboard.writeText(k);

                                    setEncryptionKey(k);
                                }}>
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={viewEncryptionKey ? "Hide key" : "Show key"}>
                                <IconButton aria-label="toggle view encryption key" edge="end" onClick={() => {
                                    setViewEncryptionKey(!viewEncryptionKey);
                                }}>
                                    {viewEncryptionKey ? <Visibility /> : <VisibilityOff />}
                                </IconButton>
                            </Tooltip>
                        </InputAdornment>
                    )
                }}
            /><br />
            <div style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
                gap: 4
            }}>
                <Button variant="contained" color="success" onClick={() => {
                    chrome.storage.local.set({
                        config: {
                            mode,
                            relayServerAddress,
                            accountID,
                            encryptionKey
                        }
                    });
                }}>Save</Button>
            </div>
        </Paper>
    )
}

export default App
