﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

using Libpc;
using System.Diagnostics;

namespace libpc_swig_test
{
    internal class TestLiblasReader : TestBase
    {
        public TestLiblasReader()
        {
            Test1();
        }

        private void Test1()
        {
            istream str = Utils.openFile("../../test/data/simple.las");
            LiblasReader r = new LiblasReader(str);

            ulong np = r.getNumPoints();

            return;
        }
    }
}
