// ==UserScript==
// @name         Spotify to Discord Status (Lyrics Sender)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Mengubah status Discord berdasarkan lirik Spotify yang sedang diputar secara real-time.
// @author       Ahmad Ridwan Hidayah
// @match        https://open.spotify.com/*
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. GLOBAL VARIABLES & CONFIGURATION
    // ==========================================
    let accessToken = ""; 
    let stopped = true;
    let startLog = false;
    let stopLog = false;
    let errorCount = 0;
    let requestsHistory = [];

    let settings = {
        // TOKEN DIKOSONGKAN AGAR AMAN, MASUKKAN LEWAT PANEL SETTINGS DI BROWSER
        token: "",
        autorun: true, 
        view: {
            timestamp: true,
            label: true,
            advanced: {
                enabled: false,
                customEmoji: "🎶",
                customStatus: "{lyrics}"
            }
        },
        timings: {
            sendTimeOffset: "0",
            autooffset: "off"
        },
        style: {
            opacity: 0.9
        }
    };

    let playbackState = {
        isPlaying: false,
        trackName: "",
        trackAuthor: "",
        trackDuration: 0,
        trackProgress: 0,
        trackId: "",
        oldTrackId: "",
        lyrics: [],
        hasLyrics: false,
        currentLyrics: ""
    };

    // ==========================================
    // 2. UI ELEMENTS INITIALIZATION
    // ==========================================
    let uiContainer = $(`
        <div id="lyrics-sender-ui" style="position: fixed; top: 20px; right: 20px; width: 320px; background: rgba(20,20,20,var(--alpha)); color: #fff; font-family: sans-serif; border-radius: 8px; padding: 15px; z-index: 99999; box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: none;">
            <h3 style="margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 8px;">Lyrics Sender Panel</h3>
            
            <!-- Tabs Menu -->
            <div style="margin-bottom: 15px;">
                <button class="tab-btn active" data-tab="run" style="background: #333; color: #fff; border: none; padding: 5px 10px; cursor: pointer; margin-right: 5px;">Run</button>
                <button class="tab-btn" data-tab="settings" style="background: #222; color: #aaa; border: none; padding: 5px 10px; cursor: pointer; margin-right: 5px;">Settings</button>
                <button class="tab-btn" data-tab="logs" style="background: #222; color: #aaa; border: none; padding: 5px 10px; cursor: pointer;">Logs</button>
            </div>

            <!-- Tab Content: Run -->
            <div id="tab-run" class="tab-content">
                <button id="btn-toggle-engine" style="width: 100%; background: #1DB954; color: #fff; border: none; padding: 10px; font-weight: bold; cursor: pointer; border-radius: 4px;">START</button>
                <div style="margin-top: 15px; font-size: 13px;">
                    <div><strong>Lagu:</strong> <span id="lbl-track-name">-</span></div>
                    <div><strong>Artis:</strong> <span id="lbl-track-author">-</span></div>
                    <div><strong>Lirik Aktif:</strong> <span id="lbl-debug-lyrics" style="color: #1DB954;">-</span></div>
                    <div><strong>Ping Playback:</strong> <span id="lbl-debug-playback">-</span></div>
                </div>
            </div>

            <!-- Tab Content: Settings -->
            <div id="tab-settings" class="tab-content" style="display: none; font-size: 13px; max-height: 250px; overflow-y: auto;">
                <div style="margin-bottom: 10px;">
                    <label>Discord Token:</label>
                    <input type="password" id="input-token" style="width: 100%; background: #333; color: #fff; border: 1px solid #444; padding: 4px; box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label><input type="checkbox" id="chk-autorun"> Jalankan Otomatis (Autorun)</label>
                </div>
                <div style="margin-bottom: 10px;">
                    <label><input type="checkbox" id="chk-timestamp"> Tampilkan Timestamp</label>
                </div>
                <div style="margin-bottom: 10px;">
                    <label><input type="checkbox" id="chk-label"> Tampilkan Label Lagu</label>
                </div>
                <div style="margin-bottom: 10px; border-top: 1px solid #333; padding-top: 8px;">
                    <label><input type="checkbox" id="chk-advanced"> Mode Kustom (Advanced)</label>
                </div>
                <div id="panel-advanced" class="hid" style="display:none; padding-left: 10px;">
                    <div style="margin-bottom: 5px;">
                        <label>Custom Emoji:</label>
                        <input type="text" id="input-emoji" style="width: 100%; background: #333; color: #fff; border: 1px solid #444; padding: 4px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 5px;">
                        <label>Custom Status Template:</label>
                        <input type="text" id="input-status-template" style="width: 100%; background: #333; color: #fff; border: 1px solid #444; padding: 4px; box-sizing: border-box;">
                    </div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label>Manual Time Offset (ms):</label>
                    <input type="number" id="input-offset" value="0" style="width: 100%; background: #333; color: #fff; border: 1px solid #444; padding: 4px; box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label>Auto Offset:</label>
                    <select id="sel-autooffset" style="width: 100%; background: #333; color: #fff; border: 1px solid #444; padding: 4px;">
                        <option value="off">Mati</option>
                        <option value="on">Aktif</option>
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <label>Transparansi UI:</label>
                    <input type="range" id="sld-opacity" min="20" max="100" value="90" style="width: 100%;">
                </div>
                <div style="margin-top: 5px; font-size: 11px; color: #aaa;">
                    Pratinjau: <span id="lbl-status-preview">-</span>
                </div>
            </div>

            <!-- Tab Content: Logs -->
            <div id="tab-logs" class="tab-content" style="display: none;">
                <div id="log-container" style="background: #000; font-family: monospace; font-size: 11px; height: 180px; overflow-y: auto; padding: 5px; border: 1px solid #333;"></div>
            </div>
        </div>
    `).appendTo(document.body);

    let userTokenInput = $("#input-token");
    let autorunCheckbox = $("#chk-autorun");
    let enableTimestampCheckbox = $("#chk-timestamp");
    let enableLabelCheckbox = $("#chk-label");
    let enableAdvancedSWT = $("#chk-advanced");
    let advancedSWT = $("#panel-advanced");
    let customEmoji = $("#input-emoji");
    let customStatus = $("#input-status-template");
    let sendTimeOffset = $("#input-offset");
    let autooffset = $("#sel-autooffset");
    let opacityRangeSlider = $("#sld-opacity");
    let statusPreview = $("#lbl-status-preview");
    
    let debugPlayback = $("#lbl-debug-playback");
    let debugLyrics = $("#lbl-debug-lyrics");
    let logContainer = $("#log-container");

    $(".tab-btn").click(function() {
        $(".tab-btn").css({"background": "#222", "color": "#aaa"}).removeClass("active");
        $(this).css({"background": "#333", "color": "#fff"}).addClass("active");
        $(".tab-content").hide();
        $("#tab-" + $(this).data("tab")).show();
    });

    $(document).keydown(function(e) {
        if (e.key === "Escape") {
            uiContainer.toggle();
        }
    });

    $("#btn-toggle-engine").click(function() {
        if (stopped) {
            stopped = false;
            startLog = true;
            $(this).text("STOP").css("background", "#e91429");
        } else {
            stopped = true;
            stopLog = true;
            $(this).text("START").css("background", "#1DB954");
        }
    });

    $("input, select").on("input change", function() {
        updateSettingsFromUI();
        saveSettings();
    });

    enableAdvancedSWT.change(function() {
        if ($(this).is(":checked")) {
            advancedSWT.show();
            enableTimestampCheckbox.prop("disabled", true);
            enableLabelCheckbox.prop("disabled", true);
        } else {
            advancedSWT.hide();
            enableTimestampCheckbox.prop("disabled", false);
            enableLabelCheckbox.prop("disabled", false);
        }
    });

    opacityRangeSlider.on("input", function() {
        let val = $(this).val() / 100;
        $(":root").css("--alpha", val);
    });

    // ==========================================
    // 3. HELPER FUNCTIONS
    // ==========================================
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function addLog(text, type = "log") {
        let color = "#fff";
        if (type === "error") color = "#ff5555";
        if (type === "warning") color = "#ffaa00";
        logContainer.append(`<div style="color: ${color}">[${new Date().toLocaleTimeString()}] ${text}</div>`);
        logContainer.scrollTop(logContainer[0].scrollHeight);
    }

    function updateSettingsFromUI() {
        settings.token = userTokenInput.val();
        settings.autorun = autorunCheckbox.is(":checked");
        settings.view.timestamp = enableTimestampCheckbox.is(":checked");
        settings.view.label = enableLabelCheckbox.is(":checked");
        settings.view.advanced.enabled = enableAdvancedSWT.is(":checked");
        settings.view.advanced.customEmoji = customEmoji.val();
        settings.view.advanced.customStatus = customStatus.val();
        settings.timings.sendTimeOffset = sendTimeOffset.val();
        settings.timings.autooffset = autooffset.val();
        settings.style.opacity = opacityRangeSlider.val() / 100;
    }

    function getStatusString(lyrics, progress) {
        let str = lyrics;
        if (settings.view.timestamp) {
            let min = Math.floor(progress / 60000);
            let sec = Math.floor((progress % 60000) / 1000).toString().padStart(2, '0');
            str = `[${min}:${sec}] ${str}`;
        }
        if (settings.view.label) {
            str = `${str} 🎶 ${playbackState.trackName || "Lagu"}`;
        }
        return str;
    }

    function parseStatusString(template, data) {
        return template
            .replace(/{lyrics}/g, data.lyrics)
            .replace(/{songName}/g, data.songName)
            .replace(/{songAuthor}/g, data.songAuthor);
    }

    // COOKIE SPOTIFY ANDA JALAN DI SINI SEBAGAI ACCESS TOKEN
    function refreshAccessToken() {
        try {
            accessToken = "AQAi8SMsJkQPVa76trfooTp3GT9FmuqXg0YWWZCK9xAd_gg6LP8wcOKLDSwg3OdIX9lVSSQ37c9PxT68qXOifOOxkJf_Jrc6X8-K2i9s1hvIEJxkeEKcGtFupx9rNAGTFXHpK7-K3ZeCuw3qO3eeMyt8EmciHWHVPbw-o3irDC1EAxXwPcNn9W1yf3iTPGTJny0uoXkKr0SSIklbH2qCCdG5DXTrQlSAGfNVtjwI5JFF-mvAcERwUFvg9ZAHrWBIsnpjY7C_iMnG0k4";
        } catch (e) {
            accessToken = "";
        }
    }

    function changeStatusRequest(token, statusText, emoji) {
        GM_xmlhttpRequest({
            method: "PATCH",
            url: "https://discord.com/api/v9/users/@me/settings",
            headers: {
                "Authorization": token,
                "Content-Type": "application/json"
            },
            data: JSON.stringify({
                custom_status: {
                    text: statusText,
                    emoji_name: emoji
                }
            }),
            onload: function(res) {
                if (res.status === 200) {
                    addLog(`Status diperbarui: "${statusText}"`);
                } else {
                    addLog(`Gagal mengubah status Discord (${res.status}). Pastikan Token Baru Valid!`, "error");
                }
            }
        });
    }

    // ==========================================
    // 4. CLOSING FUNCTIONS
    // ==========================================
    function loadSettings() {
        let settingsLoaded = localStorage.getItem("LyricsSender_settings");
        settingsLoaded = settingsLoaded ? JSON.parse(settingsLoaded) : settings;

        settings = $.extend(true, settings, settingsLoaded);

        if (settings.token) userTokenInput.val(settings.token);
        autorunCheckbox.prop("checked", settings.autorun);
        enableTimestampCheckbox.prop("checked", settings.view.timestamp);
        enableLabelCheckbox.prop("checked", settings.view.label);
        enableAdvancedSWT.prop("checked", settings.view.advanced.enabled);
        customEmoji.val(settings.view.advanced.customEmoji);
        customStatus.val(settings.view.advanced.customStatus);
        sendTimeOffset.val(settings.timings.sendTimeOffset);
        autooffset.val(settings.timings.autooffset);
        opacityRangeSlider.val(settings.style.opacity * 100);

        $(":root").css("--alpha", settings.style.opacity);
        if (settings.view.advanced.enabled) {
            advancedSWT.removeClass("hid").addClass("act");
            enableTimestampCheckbox.prop("disabled", true);
            enableLabelCheckbox.prop("disabled", true);
        }
        if (settings.timings.autooffset !== "off") {
            sendTimeOffset.prop("disabled", true);
        }
        statusPreview.text(getStatusString("La-la-la", 137000));
    }

    function saveSettings() {
        localStorage.setItem("LyricsSender_settings", JSON.stringify(settings));
    }

    async function updatePlaybackState() {
        if (!accessToken) refreshAccessToken();
        let start = Date.now();

        return $.get({
            url: "https://api.spotify.com/v1/me/player/currently-playing",
            headers: { "Authorization": "Bearer " + accessToken },
            success: (res) => {
                debugPlayback.text(`${Date.now() - start}ms`);
                if (!res || !res.is_playing) {
                    playbackState.isPlaying = false;
                    return;
                }

                playbackState.isPlaying = true;
                playbackState.trackName = res.item.name;
                $("#lbl-track-name").text(playbackState.trackName);
                playbackState.trackAuthor = res.item.artists[0].name;
                $("#lbl-track-author").text(playbackState.trackAuthor);
                
                playbackState.trackDuration = res.item.duration_ms;
                playbackState.trackProgress = res.progress_ms;
                playbackState.oldTrackId = playbackState.trackId;
                playbackState.trackId = res.item.id;

                if (playbackState.trackId !== playbackState.oldTrackId) {
                    playbackState.hasLyrics = false;
                    fetchLyrics(playbackState.trackId);
                }
            },
            error: (xhr) => {
                if (xhr.status === 401) {
                    refreshAccessToken();
                } else {
                    errorCount++;
                    addLog(`Gagal mengambil data lagu (${xhr.status})`, "error");
                }
            }
        });
    }

    function fetchLyrics(trackId) {
        $.get({
            url: `https://lrclib.net/api/get?spotifyId=${trackId}`,
            success: (data) => {
                if (data && data.syncedLyrics) {
                    playbackState.lyrics = parseLrc(data.syncedLyrics);
                    playbackState.hasLyrics = true;
                    addLog(`Lirik berhasil dimuat: ${playbackState.trackName}`);
                } else {
                    playbackState.hasLyrics = false;
                    addLog("Lirik tersinkronisasi tidak ditemukan.", "warning");
                }
            },
            error: () => {
                playbackState.hasLyrics = false;
                addLog("Gagal mengambil lirik dari database LRC.", "error");
            }
        });
    }

    function parseLrc(lrcText) {
        let lines = lrcText.split("\n");
        let result = [];
        let timeReg = /\[(\d+):(\d+)\.(\d+)\]/;
        
        for (let line of lines) {
            let match = timeReg.exec(line);
            if (match) {
                let ms = (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000 + parseInt(match[3]) * 10;
                let text = line.replace(timeReg, "").trim();
                result.push({ time: ms, text: text });
            }
        }
        return result;
    }

    async function coreLoop() {
        loadSettings();
        if (settings.autorun && settings.token) {
            stopped = false;
            startLog = true;
            $("#btn-toggle-engine").text("STOP").css("background", "#e91429");
        }

        while (true) {
            if (startLog) {
                addLog("Skrip Dimulai", "log");
                startLog = false;
            }
            if (stopLog) {
                addLog("Skrip Dihentikan", "log");
                stopLog = false;
            }

            if (!stopped && settings.token) {
                await updatePlaybackState();

                if (playbackState.isPlaying && playbackState.hasLyrics) {
                    let currentProgress = playbackState.trackProgress;
                    let activeLine = null;

                    for (let i = 0; i < playbackState.lyrics.length; i++) {
                        if (currentProgress >= playbackState.lyrics[i].time) {
                            activeLine = playbackState.lyrics[i];
                        }
                    }

                    if (activeLine && activeLine.text !== playbackState.currentLyrics) {
                        playbackState.currentLyrics = activeLine.text;
                        debugLyrics.text(activeLine.text);

                        let dynamicOffset = parseInt(settings.timings.sendTimeOffset);
                        if (settings.timings.autooffset !== "off" && requestsHistory.length > 0) {
                            dynamicOffset = requestsHistory[requestsHistory.length - 1]; 
                        }

                        let targetStatus = "";
                        let emoji = settings.view.advanced.enabled ? settings.view.advanced.customEmoji : "🎶";

                        if (settings.view.advanced.enabled) {
                            targetStatus = parseStatusString(settings.view.advanced.customStatus, {
                                lyrics: activeLine.text,
                                time: currentProgress,
                                songName: playbackState.trackName,
                                songAuthor: playbackState.trackAuthor
                            });
                        } else {
                            targetStatus = getStatusString(activeLine.text, currentProgress);
                        }

                        changeStatusRequest(settings.token, targetStatus, emoji);
                    }
                }
                await sleep(1500); 
            } else {
                await sleep(1000);
            }
        }
    }

    coreLoop();
})();
