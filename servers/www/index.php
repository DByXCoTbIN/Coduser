<?php
// Brauser IDE - Project
// Your project root
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Welcome</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 80px auto; padding: 20px; color: #333; }
        h1 { color: #007acc; }
        .info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        code { background: #e8e8e8; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
    </style>
</head>
<body>
    <h1>Brauser IDE</h1>
    <div class="info">
        <p>PHP Version: <code><?= phpversion() ?></code></p>
        <p>Server: <code><?= $_SERVER['SERVER_SOFTWARE'] ?? 'Built-in PHP' ?></code></p>
        <p>Time: <code><?= date('Y-m-d H:i:s') ?></code></p>
    </div>
    <p>Start editing your files!</p>
</body>
</html>
