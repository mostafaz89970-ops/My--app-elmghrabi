Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\منظومة العدادت 2025"
WshShell.Run "node cardServiceBridge.js", 0, False
