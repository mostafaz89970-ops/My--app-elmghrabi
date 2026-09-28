@echo off
title Smart Card Reader Service
cd /d "%~dp0"
echo Starting Smart Card Service (Port 5002)...
node internalCardServer.js
