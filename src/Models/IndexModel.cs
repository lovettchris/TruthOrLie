using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Logging;
using TruthOrLie.Firebase;

namespace TruthOrLie.Models
{
    public class IndexModel
    {
        public IndexModel(FirebaseSettings settings)
        {
            this.Settings = settings;
        }

        public void OnGet()
        {

        }

        public FirebaseSettings Settings { get; set; }
    }
}
