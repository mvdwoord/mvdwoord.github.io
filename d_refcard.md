---
layout: page
wide: true
title: RefCard
comments: no
permalink: /refcard/
---

<table class='nav-bar' style="table-layout : fixed;">
<tr>
    <th style="text-align: center;"><a href="#brew">Brew</a></th>
    <th style="text-align: center;"><a href="#git">Git</a></th>
    <th style="text-align: center;"><a href="#misc">Misc</a></th>
    <th style="text-align: center;"><a href="#python">Python</a></th>
    <th style="text-align: center;"><a href="#tmux">Tmux</a></th>
    <th style="text-align: center;"><a href="#vim">Vim</a></th>
</tr>
</table>

>This is my refcard. There are many like it, but this one is mine.

#### Brew
Use [`brew`](http://brew.sh/) for command line applications, `brew cask` for GUI apps.

| Command | Description |
|---------|--------------------------------|
| `brew doctor` | Check brew configuration |
| `brew update` | Update brew repositories |
| `brew upgrade` | Upgrade installed formulae |
| `brew list [--versions]` | List installed software [with version information] |
| `brew deps <formula>` | List dependencies for \<formula\> |
| `brew deps --installed --tree` | Show dependency tree for installed formulae |
| `brew uses --installed <formula>` | Check installed formulae that depend on \<formula\> |
| `brew cleanup -[n]s` | Clear cache, remove [dry run] old version from cellar |

#### Git

Official documentation at [git-scm](https://git-scm.com/documentation).
Branch housekeeping at [Railsware Blog](http://railsware.com/blog/2014/08/11/git-housekeeping-tutorial-clean-up-outdated-branches-in-local-and-remote-repositories/).

| Command | OMZ | Description |
|--------------|-------|-------------|
| `git status` | `gst` | Show status |
| `git log --oneline --decorate --color --abbrev-commit --all --graph` | `glola` | Show pretty commit log |
| `git commit -v` | `gc` | Commit verbose |
| `git commit -a[m "message"] ` | `gca` | Add and commit (ignores new files!) |
| `git add --all` | `gaa` | Update index with entire working tree |
| `git diff` | `gd` | Changes in the working tree not yet staged for the next commit |
| `git diff --cached` | `gdca` | Changes between the index and your last commit |
| `git diff HEAD` | `gd HEAD` | Changes in the working tree since your last commit |
| `git difftool` | `gdt` | Git diff with default difftool |
| `git remote -v` | `grv` | List remote repositories |
| `git branch -vv` | | List branches and show tracking |
| `git remote show <origin>` | | Show detailed information on \<origin\> |
| `git pull --rebase` | `gup` | Pull remote with rebase |
| `git rebase -i HEAD~x` | `grbi HEAD~x`| Interactively squash last *x* commits |

#### Misc

| Command | Description |
|---------|--------------------------------|
| `rsync -av[n] <src> <dst> [--exclude=.DS_Store]` | Archive verbose [dry run] |
| `find . -name .DS_Store -type f [-delete]` | When you forget -exclude ;) |
| `sips -Z 1024 *.jpg` | Resize images w max edge |

#### Python

[Python virtual environments](https://virtualenv.pypa.io/en/latest/)

| Command | Description |
|---------|--------------------------------|
| `virtualenv [-p /path/to/python] venv` | Create virtual environment *venv* [using specified Python interpreter] |
| `source venv/bin/activate` | Use the *venv* virtual environment |
| `deactivate` | Stop using the current virtual environment |
| `pip list [--outdated]` | List [outdated] packages |
| `pip install <package> [--upgrade]` | Install [/upgrade] \<package\> |

#### Tmux
Terminal Multiplexer [manual](http://www.openbsd.org/cgi-bin/man.cgi/OpenBSD-current/man1/tmux.1?query=tmux&sec=1)

| Command | Description |
|---------|--------------------------------|
| `tmux ls` | List sessions |
| `tmux a [-t <session-name>]` | Attach first available session |
| `tmux kill-session -t <session-name>` | Kill session |
| `tmux new [-s <session-name>]` | Create a new [named] session |
| `Ctrl-b s` | List sessions |
| `Ctrl-b w` | List Windows |

Simple configuration file stolen from around the web but mostly from [here](https://danielmiessler.com/study/tmux/#configuration).

{% highlight squid %}
# Tmux settings

# Set XTerm key bindings
setw -g xterm-keys on

# Set colors
set-option -g default-terminal "screen-256color"

#Set UTF-8 compatibility
set-window-option -g utf8 on

# Set mouse scrolling and clicking and drag to resize
set -g mode-mouse on
set -g mouse-resize-pane on
set -g mouse-select-pane on
set -g mouse-select-window on

# Set reload key to r
bind r source-file ~/.tmux.conf

# Count sessions start at 1
set -g base-index 1

# Use vim bindings
setw -g mode-keys vi

# Remap window navigation to vim
unbind-key j
bind-key j select-pane -D 
unbind-key k
bind-key k select-pane -U
unbind-key h
bind-key h select-pane -L
unbind-key l
bind-key l select-pane -R

# Set the title bar
set -g set-titles on
set -g set-titles-string '#(whoami) :: #h :: #(curl ipecho.net/plain;echo)'

# Set status bar
set -g status-utf8 on
set -g status-bg black
set -g status-fg white
set -g status-interval 5 
set -g status-left-length 90
set -g status-right-length 60
set -g status-left "#[fg=Cyan]#(whoami)::#(hostname -s)::#(curl ipecho.net/plain;echo) "
set -g status-justify left
set -g status-right '#[fg=Cyan]#S #[fg=white]%a %d %b %R'
{% endhighlight %}

#### Vim
There are many fine [vim](http://www.vim.org/docs.php) [tutorials](http://vim-adventures.com/) out there, and [cheatsheets](http://www.fprintf.net/vimCheatSheet.html) so big you could [wallpaper](http://www.viemu.com/vi-vim-cheat-sheet.gif) a decent sized house with them. I don't use vim all that much, this is just some basic stuff I tend to forget.

| Command | Description |
|---------|-------------|
| `w [W]` | Start of next word [including punctuation] |
| `e [E]` | End of next word [including punctuation] |
| `b [B]` | Back to start of word [including punctuation] |
| `0` | Beginning of line |
| `^` | Beginning of line (non-blank) |
| `$` | End of line |
| `Ctrl-b` | Page up |
| `Ctrl-f` | Page down |
| `H M L` | Place cursor High/Middle/Low on screen |
| `gg` | First line |
| `G` | Last line |
| `i [I]` | Insert [at beginning of line] |
| `a [A]` | Append [at end of line] |
| `o [O]` | Open new line below [above] |
| `u` | Undo |
| `Ctrl-r` | Redo |
| `:wq [ZZ]` | Save and quit |
| `:q! [ZQ]` | Don't save, just quit |
| `/<pattern>` | Search for \<pattern\> |
| `?<pattern>` | Search backward for \<pattern\> |
| `n` | Find next |
| `N` | Find previous |
| `:%s/<old>/<new>/g[c]` | Replace \<old\> with \<new\> in entire file (g)[with confirmation] |

I keep a very simple .vimrc

{% highlight vim %}
" Set colorscheme
syntax on               " enable syntax highlighting
colorscheme evening     " set pretty colors

" Enable line numbering and highlighting
set number              " show line numbers
set cursorline          " highlight current line
set showmatch           " highlight matching [{()}]

" Tab behavior
set tabstop=4           " number of visual spaces per TAB
set softtabstop=4       " number of spaces in tab when editing 
set expandtab           " tabs are spaces
{% endhighlight %}