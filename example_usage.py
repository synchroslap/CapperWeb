from capper.caption import UserSpec, loadFonts, main
from capper.pretty_logging import Logging, UserError
import colorama
import time

# Initialize colorama for colored terminal output
colorama.init()

# Create the specification object with your .toml file
spec_file = "samples/getting-started/spec.toml"  # Replace with your spec file path
SPEC = UserSpec(spec_file)

# Load the fonts based on the spec
FONTS = loadFonts(SPEC.characters, SPEC.text["base_font_height"]["value"])

# Create a simple args object with default values
class Args:
    def __init__(self):
        self.open_on_exit = False
        self.spec_to_stdout = False

# Set the required global variables
import capper.caption as caption
caption.SPEC = SPEC
caption.FONTS = FONTS
caption.args = Args()

# Track execution time
START_TIME = time.time()

# Run the main function
main()
print(f"Program finished in {time.time()-START_TIME:.2f} seconds")
