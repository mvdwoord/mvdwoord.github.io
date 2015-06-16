---
layout: post
title: Back from the dead
category: anecdotes
---
My dad came over for coffee with his laptop and asked me if I could “do something to add a little lifetime to it. ” ? Sure! I said, just leave it here and I’ll see what I can do. I knew he had this thing forever, but when I noticed the manufacturing date on the harddisk,  2002, I figured I might have spoken a bit too soon. To get any performance out of this old beast of a machine I figured it needed as much memory as it could handle and a SSD. Where the hell would I get a PATA/IDE SSD? Do they still make those things? did they ever make them? and what would it cost?

Fortunately there was one webshop who kept a Transcend TS32GPSD320 in stock. For a mere €54 they sent me a brand new one. The machine came with 256 MB onboard memory with a possibility to add 256 more. An online ad for 133 MHz SO DIMMs, two emails and €14 took care of that. Add to that an old PCMCIA WiFi card and stick it all in there. BIOS update to latest version A11, dated April 2004 (!) and we should be ready to rock.

After restoring the original WinXP image, running the updates etc it now takes under 30 seconds to power on, boot and log in. Nice. But I wonder, can we get this box to run some form of GNU/Linux with a light window manager to really make it shine? Perhaps something like Lubuntu? Unfortunately the Intel i830 chipset has been deprecated and is no longer supported in any of the readily available, moderately modern ditributions. Not too familiar with Linux this should be an excellent learning opportunity.

>“Oh yea, this’ll be easy and awesome!” Boy, was I wrong! This is why I’m convinced that Linux is the devil…
>--
>bloggitos

After a couple of tries with different linux live cd’s, googling the error messages and working my way through a couple of alleged solutions I started to ask myself “Is Linux really this hard, or am I just that stupid?”. Some further reading, especially regarding this specific laptop model (Inspiron 2600) it turns out it is actually one of the most Linux incompatibe pieces of hardware ever made. Apparently in order to get anything running on this box  it needs BIOS version A08. So we need to downgrade the BIOS.

No problem, DELL kindly provides us with every version they ever made. Still on the WinXP image I download the installer and it informs me a newer version is already installed. It turns out the only way to force a downgrade is to use a 3.5 inch Floppy Disk. Right. Off to the shops, and thankfully my local hardware shop still had 1 box in stock. I get to enjoy the comforting sounds of a floppy drive as it clicks, rattles and hums away.

In the end I found that the only out-of-the-box distribution that will actually install on this machine is Lubuntu 10.04, in Safe Graphics Mode during setup. And indeed, a couple of clicks and 15 minutes later I was presented with a fully functional, albeit somewhat outdated, graphical OS. Perhaps it can be upgraded to the latest version, but for now I think I’ll just see how it is received by my 70+ year old father, perhaps he just prefers WinXP anyway.