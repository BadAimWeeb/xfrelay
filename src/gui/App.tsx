import { useState } from 'react'
import { Paper, Typography, TextField, IconButton, InputAdornment, Tooltip } from "@mui/material";
import BoltIcon from '@mui/icons-material/Bolt';
import RefreshIcon from '@mui/icons-material/Refresh';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function App() {
    let [activeTab, _setActiveTab] = useState(0);
    let [activeFCAInstance, _setActiveFCAInstance] = useState(0);
    let [connected, _setConnected] = useState(false);
    let [relayServerAddress, setRelayServerAddress] = useState("");
    let [accountID, setAccountID] = useState("");
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
            /><br /><br />
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
            /><br /><br />
        </Paper>
    )
}

export default App
