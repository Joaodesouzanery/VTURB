@echo off
chcp 65001 >nul
title BaseX - instalacao do ambiente
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_env\instalar-windows.ps1"
