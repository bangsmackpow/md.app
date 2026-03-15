package com.markdownpad.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Create
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

class MainActivity : ComponentActivity() {
    private var currentFileUri by mutableStateOf<Uri?>(null)
    private var markdownText by mutableStateOf("# Welcome to MarkdownPad\n\nStart writing your markdown here!\n\n## Features\n- **Bold** and *italic*\n- Lists\n- Code blocks\n- And more...\n")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                MarkdownEditorScreen(
                    markdownText = markdownText,
                    onMarkdownChange = { markdownText = it },
                    currentFileUri = currentFileUri,
                    onOpenFile = { openFile() },
                    onSaveFile = { saveFile() }
                )
            }
        }
    }

    private fun openFile() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/markdown", "text/plain", "text/x-markdown"))
        }
        startActivityForResult(intent, 1001)
    }

    private fun saveFile() {
        if (currentFileUri != null) {
            try {
                contentResolver.openOutputStream(currentFileUri!!)?.use { outputStream ->
                    OutputStreamWriter(outputStream).use { writer ->
                        writer.write(markdownText)
                    }
                }
                Toast.makeText(this, "Saved!", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "Save failed: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        } else {
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "text/markdown"
                putExtra(Intent.EXTRA_TITLE, "untitled.md")
            }
            startActivityForResult(intent, 1002)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode == Activity.RESULT_OK && data != null) {
            val uri = data.data
            when (requestCode) {
                1001 -> {
                    uri?.let { fileUri ->
                        currentFileUri = fileUri
                        try {
                            contentResolver.openInputStream(fileUri)?.use { inputStream ->
                                BufferedReader(InputStreamReader(inputStream)).use { reader ->
                                    markdownText = reader.readText()
                                }
                            }
                        } catch (e: Exception) {
                            Toast.makeText(this, "Failed to open file: ${e.message}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                1002 -> {
                    uri?.let { fileUri ->
                        currentFileUri = fileUri
                        try {
                            contentResolver.openOutputStream(fileUri)?.use { outputStream ->
                                OutputStreamWriter(outputStream).use { writer ->
                                    writer.write(markdownText)
                                }
                            }
                            Toast.makeText(this, "File created!", Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            Toast.makeText(this, "Failed to create file: ${e.message}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MarkdownEditorScreen(
    markdownText: String,
    onMarkdownChange: (String) -> Unit,
    currentFileUri: Uri?,
    onOpenFile: () -> Unit,
    onSaveFile: () -> Unit
) {
    var isPreviewMode by remember { mutableStateOf(false) }
    var showModeIndicator by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (currentFileUri != null) "MarkdownPad - Modified" else "MarkdownPad") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                ),
                actions = {
                    IconButton(onClick = onOpenFile) {
                        Icon(Icons.Default.Create, contentDescription = "Open")
                    }
                    IconButton(onClick = onSaveFile) {
                        Icon(Icons.Default.Edit, contentDescription = "Save")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .pointerInput(Unit) {
                    detectHorizontalDragGestures { _, dragAmount ->
                        if (dragAmount > 50) {
                            isPreviewMode = false
                            showModeIndicator = true
                        } else if (dragAmount < -50) {
                            isPreviewMode = true
                            showModeIndicator = true
                        }
                    }
                }
        ) {
            if (isPreviewMode) {
                MarkdownPreview(markdownText = markdownText)
            } else {
                MarkdownEditor(
                    text = markdownText,
                    onTextChange = onMarkdownChange
                )
            }

            if (showModeIndicator) {
                LaunchedEffect(Unit) {
                    kotlinx.coroutines.delay(500)
                    showModeIndicator = false
                }
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp)
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
                            MaterialTheme.shapes.medium
                        )
                        .padding(horizontal = 24.dp, vertical = 12.dp)
                ) {
                    Text(
                        text = if (isPreviewMode) "Preview Mode" else "Edit Mode",
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
        }
    }
}

@Composable
fun MarkdownEditor(text: String, onTextChange: (String) -> Unit) {
    TextField(
        value = text,
        onValueChange = onTextChange,
        modifier = Modifier
            .fillMaxSize()
            .padding(8.dp),
        textStyle = androidx.compose.ui.text.TextStyle(
            fontFamily = FontFamily.Monospace,
            fontSize = 14.sp
        ),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
fun MarkdownPreview(markdownText: String) {
    val parser = Parser.builder().build()
    val renderer = HtmlRenderer.builder().build()
    val document = parser.parse(markdownText)
    val html = renderer.render(document)

    val styledHtml = """
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 16px;
                    line-height: 1.6;
                    color: #212121;
                }
                h1, h2, h3, h4, h5, h6 { color: #1a1a1a; margin-top: 24px; }
                h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 8px; }
                h2 { font-size: 1.5em; }
                code {
                    background: #f5f5f5;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: monospace;
                }
                pre {
                    background: #f5f5f5;
                    padding: 16px;
                    border-radius: 8px;
                    overflow-x: auto;
                }
                pre code { background: none; padding: 0; }
                blockquote {
                    border-left: 4px solid #6200EE;
                    margin: 16px 0;
                    padding-left: 16px;
                    color: #666;
                }
                a { color: #6200EE; }
                ul, ol { padding-left: 24px; }
                li { margin: 8px 0; }
                table { border-collapse: collapse; width: 100%; margin: 16px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f5f5f5; }
                hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
                img { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
        $html
        </body>
        </html>
    """.trimIndent()

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            android.webkit.WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.loadWithOverviewMode = true
                settings.useWideViewPort = true
                settings.builtInZoomControls = true
                settings.displayZoomControls = false
            }
        },
        update = { webView ->
            webView.loadDataWithBaseURL(null, styledHtml, "text/html", "UTF-8", null)
        }
    )
}