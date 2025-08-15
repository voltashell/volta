" AI Agent Vim Configuration
" A modern, minimal vim setup for coding in containers

" Basic Settings
set nocompatible              " Use Vim defaults (not Vi)
set encoding=utf-8            " UTF-8 encoding
set fileencoding=utf-8
set backspace=indent,eol,start " Make backspace work as expected
set history=1000              " Command history
set showcmd                   " Show incomplete commands
set showmode                  " Show current mode
set autoread                  " Reload files changed outside vim
set hidden                    " Allow hidden buffers

" UI Settings
set number                    " Show line numbers
set relativenumber           " Show relative line numbers
set ruler                    " Show cursor position
set cursorline               " Highlight current line
set wrap                     " Wrap long lines
set linebreak                " Break lines at word boundaries
set showmatch                " Highlight matching brackets
set matchtime=2              " Tenths of a second to show match
set scrolloff=5              " Keep 5 lines above/below cursor
set sidescrolloff=5          " Keep 5 columns left/right of cursor
set laststatus=2             " Always show status line
set wildmenu                 " Command line completion
set wildmode=longest:full,full

" Search Settings
set hlsearch                 " Highlight search results
set incsearch                " Incremental search
set ignorecase               " Case insensitive search
set smartcase                " Case sensitive if uppercase used
set magic                    " Use magic for regular expressions

" Indentation
set autoindent               " Auto indent new lines
set smartindent              " Smart indenting
set expandtab                " Use spaces instead of tabs
set tabstop=2                " Tab width
set shiftwidth=2             " Indent width
set softtabstop=2            " Soft tab width
set shiftround               " Round indent to multiple of shiftwidth

" File Type Detection
filetype on
filetype plugin on
filetype indent on

" Syntax Highlighting
if has("syntax")
  syntax enable
  set t_Co=256               " 256 colors
  set background=dark        " Dark background
  
  " Custom colors for better visibility in terminals
  highlight LineNr ctermfg=grey
  highlight CursorLine cterm=NONE ctermbg=235
  highlight Search ctermbg=yellow ctermfg=black
  highlight Visual ctermbg=238
endif

" Performance
set lazyredraw               " Don't redraw while executing macros
set ttyfast                  " Fast terminal connection
set synmaxcol=200            " Only syntax highlight first 200 columns

" Backup and Swap
set nobackup                 " No backup files
set nowritebackup            " No backup before overwriting
set noswapfile               " No swap files

" Mouse Support (if available)
if has('mouse')
  set mouse=a                " Enable mouse in all modes
endif

" Key Mappings
let mapleader = ","          " Set leader key to comma

" Easy navigation between splits
nnoremap <C-h> <C-w>h
nnoremap <C-j> <C-w>j
nnoremap <C-k> <C-w>k
nnoremap <C-l> <C-w>l

" Clear search highlighting
nnoremap <leader><space> :nohlsearch<CR>

" Quick save and quit
nnoremap <leader>w :w<CR>
nnoremap <leader>q :q<CR>
nnoremap <leader>x :x<CR>

" Move lines up/down
nnoremap <A-j> :m .+1<CR>==
nnoremap <A-k> :m .-2<CR>==
vnoremap <A-j> :m '>+1<CR>gv=gv
vnoremap <A-k> :m '<-2<CR>gv=gv

" Better indenting in visual mode
vnoremap < <gv
vnoremap > >gv

" Navigate buffers
nnoremap <leader>n :bnext<CR>
nnoremap <leader>p :bprevious<CR>
nnoremap <leader>d :bdelete<CR>

" Toggle line numbers
nnoremap <leader>ln :set number!<CR>:set relativenumber!<CR>

" File Explorer (netrw) Settings
let g:netrw_banner = 0       " Hide banner
let g:netrw_liststyle = 3    " Tree view
let g:netrw_browse_split = 4 " Open in previous window
let g:netrw_winsize = 25     " Width of explorer
let g:netrw_altv = 1         " Open splits to the right

" Toggle file explorer
nnoremap <leader>e :Lexplore<CR>

" Auto Commands
if has("autocmd")
  " Remove trailing whitespace on save
  autocmd BufWritePre * :%s/\s\+$//e
  
  " Return to last edit position when opening files
  autocmd BufReadPost *
    \ if line("'\"") > 0 && line("'\"") <= line("$") |
    \   exe "normal! g`\"" |
    \ endif
  
  " File type specific settings
  autocmd FileType python setlocal tabstop=4 shiftwidth=4 softtabstop=4
  autocmd FileType javascript,typescript,json setlocal tabstop=2 shiftwidth=2 softtabstop=2
  autocmd FileType yaml setlocal tabstop=2 shiftwidth=2 softtabstop=2
  autocmd FileType markdown setlocal wrap linebreak spell
endif

" Status Line
set statusline=
set statusline+=%#PmenuSel#
set statusline+=\ %f         " File name
set statusline+=%m            " Modified flag
set statusline+=%=            " Right align
set statusline+=%#CursorColumn#
set statusline+=\ %y          " File type
set statusline+=\ %{&fileencoding?&fileencoding:&encoding}
set statusline+=\ [%{&fileformat}]
set statusline+=\ %p%%        " Percentage
set statusline+=\ %l:%c       " Line:Column
set statusline+=\ 

" Quick Tips Display
function! ShowTips()
  echo "Vim Tips for AI Agents:"
  echo "  ,e        - Toggle file explorer"
  echo "  ,w        - Save file"
  echo "  ,q        - Quit"
  echo "  ,<space>  - Clear search highlight"
  echo "  :vs file  - Vertical split"
  echo "  :sp file  - Horizontal split"
  echo "  Ctrl+w    - Navigate splits"
  echo "  /pattern  - Search"
  echo "  n/N       - Next/Previous match"
endfunction

" Show tips on startup
autocmd VimEnter * if argc() == 0 | call ShowTips() | endif

" Map to show tips
nnoremap <leader>? :call ShowTips()<CR>