from spec_parse import UserSpec
from caption import loadFonts
import caption as captioner
from pretty_logging import Logging, UserError
import colorama
import time

def generateCaption():
    colorama.init()
    START_TIME = time.time()
    try:
        SPEC = UserSpec("../samples/getting-started/spec.toml")
        FONTS = loadFonts(SPEC.characters, SPEC.text["base_font_height"]["value"])

        captioner.SPEC = SPEC
        captioner.FONTS = FONTS

        captioner.main()
        Logging.header(f"Program finished in {time.time()-START_TIME:.2f} seconds")
        Logging.divider()
    except UserError as e:
        Logging.divider()
        print(f"\nUserError: {e.message}")

if __name__ == '__main__':
    generateCaption()