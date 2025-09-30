# Known Caveats and Limitations

This page documents known limitations and workarounds when using vibe coding assistants in Databricks Devbox.

## Image and Screenshot Support

### Screenshot Paste Not Available

Currently, pasting screenshots directly into the chat is not supported.

**Workaround:** To share images with the assistant:

1. Upload your image file into the code-server editor
2. Reference the file using the `@` symbol followed by the file path
3. The assistant will be able to view and analyze the image

**Example:**
```
@screenshot.png Can you help me understand what's happening in this UI?
```

---

*More caveats will be documented here as they are discovered.*
