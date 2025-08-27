try {
                        let e = await fetch("https://kick.com/api/v2/channels/".concat(n))
                          , a = await e.json();
                        if (l)
                            return;
                        let r = a.chatroom.id;
                        (t = new WebSocket("wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false")).onopen = () => {
                            t.send(JSON.stringify({
                                event: "pusher:subscribe",
                                data: {
                                    auth: "",
                                    channel: "chatrooms.".concat(r, ".v2")
                                }
                            })),
                            s = setInterval( () => {
                                t.readyState === WebSocket.OPEN && t.send(JSON.stringify({
                                    event: "pusher:ping",
                                    data: {}
                                }))
                            }
                            , 12e3)
                        }
                        ,
                        t.onmessage = e => {
                            let t = JSON.parse(e.data);
                            if ("App\\Events\\ChatMessageEvent" === t.event) {
                                let e = JSON.parse(t.data)
                                  , s = e.sender.username
                                  , l = e.sender.slug
                                  , a = e.content.trim();
                                if (s.toLowerCase(),
                                n.toLowerCase(),
                                e.sender.is_moderator,
                                m && h) {
                                    let e = h.name;
                                    (function(e, t) {
                                        let s, l;
                                        if (e = N(e.trim().toLowerCase()),
                                        t = N(t.trim().toLowerCase()),
                                        !e || !t)
                                            return 0;
                                        let n = [];
                                        for (s = 0; s <= t.length; s++)
                                            n[s] = [s];
                                        for (l = 0; l <= e.length; l++)
                                            n[0][l] = l;
                                        for (s = 1; s <= t.length; s++)
                                            for (l = 1; l <= e.length; l++)
                                                t.charAt(s - 1) === e.charAt(l - 1) ? n[s][l] = n[s - 1][l - 1] : n[s][l] = Math.min(n[s - 1][l - 1] + 1, Math.min(n[s][l - 1] + 1, n[s - 1][l] + 1));
                                        let a = n[t.length][e.length]
                                          , r = Math.max(e.length, t.length);
                                        return 0 === r ? 1 : 1 - a / r
                                    }
                                    )(a, e) >= .9 && (u(!1),
                                    w({
                                        login: s,
                                        disp: l
                                    }),
                                    p(e => {
                                        let t = e.findIndex(e => e.login === s);
                                        if (-1 === t)
                                            return [...e, {
                                                login: s,
                                                display: l,
                                                points: 1
                                            }];
                                        {
                                            let s = [...e];
                                            return s[t] = {
                                                ...s[t],
                                                display: l,
                                                points: s[t].points + 1
                                            },
                                            s
                                        }
                                    }
                                    ),
                                    g("\uD83C\uDF89 @".concat(l, " (").concat(s, ") أجاب بشكل صحيح (").concat(e, ")!")),
                                    setTimeout( () => v(), 5e3))
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Kick connection error:", e)
                    }
