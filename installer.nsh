; ===== WITH U 自定义安装/卸载脚本 =====
; 
; customInstall: 安装时清除 API 密钥（保留角色数据）
; customUnInstall: 卸载时交互式询问是否删除 TTS 模型 / Python 运行时
!macro customInstall
  ; 清除 API 配置文件（移除已保存的 API Key），保留角色数据
  Delete "$APPDATA\with-u\api-profiles.json"
!macroend

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "是否删除 TTS 模型？（约 2.3GB）$\n不删除下次使用无需重新下载。" \
    /SD IDYES IDNO skip_tts
    RMDir /r "$APPDATA\with-u\models\index-tts"
    Delete "$APPDATA\with-u\index-tts.tar.gz"
  skip_tts:

  MessageBox MB_YESNO|MB_ICONQUESTION \
    "是否删除 Python 运行时？（约 1.6GB）$\n删除后需要重新安装 Python 依赖。" \
    /SD IDNO IDNO skip_python
    RMDir /r "$INSTDIR\python"
    RMDir /r "$APPDATA\with-u\python-dist"
  skip_python:

  ; 清理缓存文件（可选安全清理）
  RMDir /r "$APPDATA\with-u\Cache"
  RMDir /r "$APPDATA\with-u\Code Cache"
  RMDir /r "$APPDATA\with-u\GPUCache"
  RMDir /r "$APPDATA\with-u\DawnGraphiteCache"
  RMDir /r "$APPDATA\with-u\DawnWebGPUCache"
  RMDir /r "$APPDATA\with-u\VideoDecodeStats"

  ; 清除 API 配置文件
  Delete "$APPDATA\with-u\api-profiles.json"

  ; 保留以下用户数据：
  ; - $APPDATA\with-u\character\   (角色配置、聊天记录、记忆)
  ; - $APPDATA\with-u\tts-settings.json
  ; - $APPDATA\with-u\pet-actions.json
!macroend
