# CapperWeb
Fully-local browser implementation of substantialpickle's [Capper](https://github.com/substantialpickle/Capper). 
Wraps a web UI around the (mostly) original Python implementation using [Pyodide](https://github.com/pyodide/pyodide). 

## How to Use
Go to this project's [Github pages link](https://synchroslap.github.io/CapperWeb/).

Minimum information to generate caption is Project Name, Image Upload, and Text.

"Characters" are your custom font styles. To use a character, type its name in square brackets followed by the text 
you want to use that style on. You can click the Insert button on the character to quickly insert this tag. 

See the [README of my previous project](https://github.com/synchroslap/CapperGUI?tab=readme-ov-file#characters) or the 
[original Capper project sample text](https://github.com/substantialpickle/Capper/blob/main/samples/getting-started/text.txt) 
to get a better idea of how this works.

Once you have all your details filled out, click Generate. This may take a while if your image is large. Your browser 
tab may freeze up on larger images, but it should eventually successfully complete (what did you expect, I shoved an 
entire Python runtime into a browser). Your completed caption should display at the bottom of the screen. Right click
and save image to download your caption.

Note that credits will use the the text settings of whatever your first character is.

## To Do List
- Spoonfeed guide 


